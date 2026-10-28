-- Refuse ambiguous legacy SKUs rather than merging or rewriting business data.
do $$ begin
  if exists (select 1 from public.products where nullif(btrim(sku),'') is not null
    group by upper(btrim(sku)) having count(*) > 1) then
    raise exception 'SKU çakışmaları çözülmeden güncelleme uygulanamaz.';
  end if;
end $$;
create unique index products_normalized_sku_unique on public.products ((upper(btrim(sku))))
  where nullif(btrim(sku),'') is not null;

create function private.normalize_product_sku() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.sku := nullif(upper(btrim(new.sku)),'');
  if new.sku is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.sku,9182));
  end if;
  return new;
end $$;
revoke all on function private.normalize_product_sku() from public,anon,authenticated;
create trigger products_normalize_sku before insert or update of sku on public.products
for each row execute function private.normalize_product_sku();

-- Stable client-generated UUID makes a lost response/retry update the same product.
-- Stock is inserted only once, never reset on retries. Product + cost are atomic.
create function public.admin_save_product(p_id uuid,p_product jsonb,p_cost numeric default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_variant boolean; v_exists boolean;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_admins where user_id=(select auth.uid())
  ) then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
  if p_id is null or p_product is null or jsonb_typeof(p_product)<>'object'
    or char_length(btrim(p_product->>'name')) not between 2 and 200
    or nullif(p_product->>'name','') is null
    or coalesce(p_product->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or (p_product->>'price') is null
    or (p_product->>'price')::numeric < 0
    or (p_product->>'price')::numeric <> round((p_product->>'price')::numeric,2)
    or (p_cost is not null and (p_cost<0 or p_cost>9999999999.99 or p_cost<>round(p_cost,2)))
  then raise exception 'Ürün bilgileri geçersiz.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,9183));
  if nullif(upper(btrim(p_product->>'sku')),'') is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(upper(btrim(p_product->>'sku')),9182));
  end if;
  select has_variants into v_variant from public.products where id=p_id for update;
  v_exists := found;
  if not v_exists then
    insert into public.products(id,name,slug,description,category_id,sku,price,compare_at_price,
      stock_quantity,low_stock_threshold,is_active,is_featured)
    values(p_id,btrim(p_product->>'name'),p_product->>'slug',p_product->>'description',
      (p_product->>'category_id')::uuid,p_product->>'sku',(p_product->>'price')::numeric,
      (p_product->>'compare_at_price')::numeric,coalesce((p_product->>'stock_quantity')::integer,0),
      (p_product->>'low_stock_threshold')::integer,(p_product->>'is_active')::boolean,
      (p_product->>'is_featured')::boolean);
  else
    update public.products set name=btrim(p_product->>'name'),slug=p_product->>'slug',
      description=p_product->>'description',category_id=(p_product->>'category_id')::uuid,
      sku=p_product->>'sku',price=(p_product->>'price')::numeric,
      compare_at_price=(p_product->>'compare_at_price')::numeric,
      low_stock_threshold=(p_product->>'low_stock_threshold')::integer,
      is_active=(p_product->>'is_active')::boolean,is_featured=(p_product->>'is_featured')::boolean
    where id=p_id;
  end if;
  if not coalesce(v_variant,false) then
    if p_cost is null then delete from public.product_costs where product_id=p_id;
    else
      insert into public.product_costs(product_id,cost_price,updated_by,updated_at)
      values(p_id,p_cost,(select auth.uid()),now())
      on conflict(product_id) do update set cost_price=excluded.cost_price,
        updated_by=excluded.updated_by,updated_at=excluded.updated_at;
    end if;
  end if;
  return p_id;
end $$;
revoke all on function public.admin_save_product(uuid,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.admin_save_product(uuid,jsonb,numeric) to authenticated;

-- Snapshot uses full product row + private cost. Never trust client old values:
-- compare them against locked current rows before invoking the existing importer.
create function public.admin_confirm_product_import(p_rows jsonb,p_commit boolean default false,
 p_allow_stock_updates boolean default false,p_expected jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb; v_snapshot jsonb; v_sku text;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_admins where user_id=(select auth.uid())
  ) then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 200 then
    raise exception 'Aktarım 1–200 satır olmalı.' using errcode='22023'; end if;
  if p_commit then
    for v_sku in select distinct upper(btrim(value->>'sku')) from jsonb_array_elements(p_rows) order by 1 loop
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_sku,9182));
    end loop;
    perform p.id from public.products p where upper(btrim(p.sku)) in
      (select upper(btrim(value->>'sku')) from jsonb_array_elements(p_rows)) order by p.id for update;
    perform c.product_id from public.product_costs c join public.products p on p.id=c.product_id
      where upper(btrim(p.sku)) in (select upper(btrim(value->>'sku')) from jsonb_array_elements(p_rows))
      order by c.product_id for update of c;
  end if;
  select jsonb_agg(jsonb_build_object('sku',r.value->>'sku','id',p.id,
    'signature',case when p.id is null then null else md5(to_jsonb(p)::text||coalesce(to_jsonb(c)::text,'')) end,
    'stock',p.stock_quantity,'price',p.price) order by r.n) into v_snapshot
  from jsonb_array_elements(p_rows) with ordinality r(value,n)
  left join public.products p on upper(btrim(p.sku))=upper(btrim(r.value->>'sku'))
  left join public.product_costs c on c.product_id=p.id;
  if p_commit and (p_expected is null or p_expected is distinct from v_snapshot) then
    raise exception 'Önizlemeden sonra ürün bilgileri değişti.' using errcode='40001';
  end if;
  v_result := public.admin_bulk_import_products(p_rows,p_commit,p_allow_stock_updates);
  return v_result || jsonb_build_object('expected',v_snapshot,'rows',(
    select jsonb_agg(value || jsonb_build_object('previous_stock',v_snapshot->(n::int-1)->'stock',
      'previous_price',v_snapshot->(n::int-1)->'price') order by n)
    from jsonb_array_elements(v_result->'rows') with ordinality r(value,n)
  ));
end $$;
revoke all on function public.admin_confirm_product_import(jsonb,boolean,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.admin_confirm_product_import(jsonb,boolean,boolean,jsonb) to authenticated;

-- Both lists are independently paged. Claimed quantities use every request,
-- while history is complete for only the current request page.
create function public.customer_return_page(p_orders_page integer default 1,p_requests_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_ot bigint; v_rt bigint; v_op integer; v_rp integer;
 v_orders jsonb; v_requests jsonb; v_history jsonb;
begin
  if v_uid is null then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
  if p_orders_page is null or p_requests_page is null or p_orders_page not between 1 and 999999
    or p_requests_page not between 1 and 999999 then
    raise exception 'Geçersiz sayfa.' using errcode='22023'; end if;
  select count(*) into v_ot from public.order_requests where customer_user_id=v_uid and status in ('delivered','completed');
  select count(*) into v_rt from public.order_return_requests where customer_user_id=v_uid;
  v_op:=least(p_orders_page,greatest(1,ceil(v_ot/20.0)::int));
  v_rp:=least(p_requests_page,greatest(1,ceil(v_rt/20.0)::int));
  select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('order_request_items',(
    select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,
      'variant_label',i.variant_label,'quantity',i.quantity,'claimed_quantity',(
        select coalesce(sum(r.quantity),0) from public.order_return_requests r
        where r.order_item_id=i.id and r.customer_user_id=v_uid and r.status<>'rejected'
      )) order by i.id),'[]'::jsonb) from public.order_request_items i where i.order_request_id=o.id
    )) order by o.created_at desc,o.id desc),'[]'::jsonb) into v_orders
  from (select id,reference,status,created_at from public.order_requests where customer_user_id=v_uid
    and status in ('delivered','completed') order by created_at desc,id desc limit 20 offset (v_op-1)*20) o;
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('order_reference',o.reference,
    'product_name',i.product_name,'variant_label',i.variant_label)
    order by r.created_at desc,r.id desc),'[]'::jsonb) into v_requests
  from (select id,order_request_id,order_item_id,quantity,request_type,reason,customer_note,status,
    admin_note,condition_on_receipt,restocked_quantity,received_at,created_at from public.order_return_requests
    where customer_user_id=v_uid order by created_at desc,id desc limit 20 offset (v_rp-1)*20) r
    join public.order_requests o on o.id=r.order_request_id
    join public.order_request_items i on i.id=r.order_item_id;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at,h.id),'[]'::jsonb) into v_history
  from (select id,return_request_id,from_status,to_status,note,created_at from public.order_return_status_history
    where return_request_id in (select (value->>'id')::uuid from jsonb_array_elements(v_requests))) h;
  return jsonb_build_object('orders',v_orders,'requests',v_requests,'history',v_history,
    'ordersMeta',jsonb_build_object('page',v_op,'total',v_ot,'pages',greatest(1,ceil(v_ot/20.0)::int)),
    'requestsMeta',jsonb_build_object('page',v_rp,'total',v_rt,'pages',greatest(1,ceil(v_rt/20.0)::int)));
end $$;
revoke all on function public.customer_return_page(integer,integer) from public,anon,authenticated;
grant execute on function public.customer_return_page(integer,integer) to authenticated;

-- Public bucket URLs remain readable; listing and retry/upsert need admin SELECT.
create policy "Store admins can read product image objects"
on storage.objects for select to authenticated using (
 bucket_id='product-images' and exists (
   select 1 from public.store_admins where user_id=(select auth.uid())
 )
);
