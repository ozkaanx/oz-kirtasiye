-- Active quote/checkout flows share catalog validation, savings and delivery rules.
-- All helpers are invokers in an unexposed schema; existing service-only RPCs keep their ACLs.
create function private.checkout_catalog_snapshot(p_items jsonb,p_lock boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_row jsonb; v_product uuid; v_variant uuid; v_raw text; v_qty integer;
 v_name text; v_category uuid; v_price numeric(12,2); v_stock integer; v_has_variants boolean;
 v_label text; v_seen text[]:='{}'; v_key text; v_subtotal numeric(12,2):=0; v_lines jsonb:='[]';
begin
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20 then
  raise exception 'Sepet geçersiz.' using errcode='22023'; end if;
 for v_row in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_row)<>'object'
   or coalesce(v_row->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or coalesce(v_row->>'quantity','') !~ '^[1-9][0-9]?$' then
   raise exception 'Sepet satırı geçersiz.' using errcode='22023'; end if;
  v_product:=(v_row->>'productId')::uuid; v_qty:=(v_row->>'quantity')::integer;
  v_raw:=nullif(v_row->>'variantId','');
  if v_raw is not null and v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'Geçersiz varyant.' using errcode='22023'; end if;
  v_variant:=v_raw::uuid; v_label:=null;
  v_key:=v_product::text||':'||coalesce(v_variant::text,'standard');
  if v_key=any(v_seen) then raise exception 'Yinelenen sepet satırı.' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,v_key);
  if p_lock then
   select p.name,p.category_id,p.price,p.stock_quantity,p.has_variants
    into v_name,v_category,v_price,v_stock,v_has_variants from public.products p
    where p.id=v_product and p.is_active for share;
  else
   select p.name,p.category_id,p.price,p.stock_quantity,p.has_variants
    into v_name,v_category,v_price,v_stock,v_has_variants from public.products p
    where p.id=v_product and p.is_active;
  end if;
  if not found or (v_has_variants and v_variant is null) or (not v_has_variants and v_variant is not null) then
   raise exception 'Ürün veya varyant satışta değil.' using errcode='22023'; end if;
  if v_variant is not null then
   if p_lock then
    select v.price,v.stock_quantity,concat_ws(' / ',nullif(v.color,''),nullif(v.size,''))
     into v_price,v_stock,v_label from public.product_variants v
     where v.id=v_variant and v.product_id=v_product and v.is_active for share;
   else
    select v.price,v.stock_quantity,concat_ws(' / ',nullif(v.color,''),nullif(v.size,''))
     into v_price,v_stock,v_label from public.product_variants v
     where v.id=v_variant and v.product_id=v_product and v.is_active;
   end if;
   if not found then raise exception 'Seçilen varyant satışta değil.' using errcode='22023'; end if;
  end if;
  if v_stock<v_qty then raise exception 'Stok yetersiz.' using errcode='22023'; end if;
  v_subtotal:=v_subtotal+v_price*v_qty;
  if v_subtotal>999999.99 then raise exception 'Sepet tutarı sınırı aşıyor.' using errcode='22023'; end if;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('productId',v_product,'variantId',v_variant,
   'categoryId',v_category,'productName',v_name,'variantLabel',v_label,'unitPrice',v_price,'quantity',v_qty,'lineTotal',v_price*v_qty));
 end loop;
 return jsonb_build_object('subtotal',v_subtotal,'lines',v_lines);
end;
$$;
revoke all on function private.checkout_catalog_snapshot(jsonb,boolean) from public,anon,authenticated;

create function private.order_shipping_fee(p_method text,p_subtotal numeric,p_discount numeric default 0,p_lock boolean default false)
returns numeric language plpgsql security invoker set search_path='' as $$
declare s record;
begin
 if p_lock then select shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold into s from public.store_settings where id=1 for share;
 else select shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold into s from public.store_settings where id=1; end if;
 if not found then raise exception 'Mağaza teslimat ayarları bulunamadı.' using errcode='22023'; end if;
 if p_method='pickup' and s.pickup_enabled then return 0;
 elsif p_method='shipping' and s.shipping_enabled and s.shipping_flat_fee is not null then
  return case when s.free_shipping_threshold is not null and p_subtotal-p_discount>=s.free_shipping_threshold then 0 else s.shipping_flat_fee end;
 end if;
 raise exception 'Teslimat seçeneği şu anda aktif değil.' using errcode='22023';
end;
$$;
revoke all on function private.order_shipping_fee(text,numeric,numeric,boolean) from public,anon,authenticated;

create function private.order_savings(p_lines jsonb,p_subtotal numeric,p_method text,p_coupon_code text,p_phone text,p_user_id uuid,p_lock boolean default false)
returns table(discount_amount numeric,shipping_fee numeric,total numeric,coupon_id uuid,code text,campaign_id uuid,campaign_name text)
language plpgsql security invoker set search_path='' as $$
declare a record; c record; v_discount numeric(12,2):=0; v_fee numeric(12,2);
 v_coupon uuid; v_code text; v_campaign uuid; v_name text;
begin
 select * into a from private.best_automatic_campaign(p_lines,p_subtotal);
 if a.campaign_id is not null then
  if p_lock then
   perform 1 from public.automatic_campaigns x where x.id=a.campaign_id and x.is_active and now()>=x.starts_at
    and (x.expires_at is null or now()<x.expires_at) for share;
   if not found then raise exception 'Kampanya durumu değişti, tekrar dene.' using errcode='22023'; end if;
  end if;
  v_discount:=a.discount_amount; v_campaign:=a.campaign_id; v_name:=a.campaign_name;
 end if;
 if nullif(btrim(coalesce(p_coupon_code,'')),'') is not null then
  select * into c from private.coupon_discount(p_coupon_code,p_subtotal,p_phone,p_user_id,p_lock);
  if c.amount>v_discount then
   v_discount:=c.amount; v_coupon:=c.coupon_id; v_code:=c.code; v_campaign:=null; v_name:=null;
  end if;
 end if;
 v_fee:=private.order_shipping_fee(p_method,p_subtotal,v_discount,p_lock);
 return query select v_discount,v_fee,p_subtotal-v_discount+v_fee,v_coupon,v_code,v_campaign,v_name;
end;
$$;
revoke all on function private.order_savings(jsonb,numeric,text,text,text,uuid,boolean) from public,anon,authenticated;

create or replace function public.submit_order_request(p_customer_name text,p_phone text,p_city text,p_district text,p_address text,p_note text,p_items jsonb)
returns table(id uuid,reference text,subtotal numeric)
language plpgsql security definer set search_path='' as $$
declare v_name text:=trim(coalesce(p_customer_name,'')); v_phone text:=trim(coalesce(p_phone,''));
 v_city text:=trim(coalesce(p_city,'')); v_district text:=trim(coalesce(p_district,''));
 v_address text:=trim(coalesce(p_address,'')); v_note text:=nullif(trim(coalesce(p_note,'')),'');
 v_id uuid:=gen_random_uuid(); v_reference text; v_snapshot jsonb; v_line jsonb; v_subtotal numeric(12,2);
begin
 if char_length(v_name) not between 3 and 100 or char_length(v_city) not between 2 and 80
  or char_length(v_district) not between 2 and 80 or char_length(v_address) not between 10 and 500
  or char_length(coalesce(v_note,''))>500 or v_phone !~ '^[+0-9 ()-]{10,20}$'
  or char_length(regexp_replace(v_phone,'[^0-9]','','g')) not between 10 and 13 then
  raise exception 'Teslimat bilgileri geçersiz.' using errcode='22023'; end if;
 v_phone:=regexp_replace(v_phone,'[^0-9]','','g');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone,2099));
 if (select count(*) from public.order_requests o where o.phone=v_phone and o.created_at>now()-interval '1 hour')>=3 then
  raise exception 'Çok fazla talep gönderildi. Daha sonra tekrar deneyin.' using errcode='22023'; end if;
 v_snapshot:=private.checkout_catalog_snapshot(p_items,true); v_subtotal:=(v_snapshot->>'subtotal')::numeric;
 v_reference:='OZ-'||upper(substr(replace(v_id::text,'-',''),1,12));
 insert into public.order_requests(id,reference,customer_name,phone,city,district,address,note,subtotal)
 values(v_id,v_reference,v_name,v_phone,v_city,v_district,v_address,v_note,v_subtotal);
 for v_line in select value from jsonb_array_elements(v_snapshot->'lines') loop
  insert into public.order_request_items(order_request_id,product_id,variant_id,variant_label,product_name,unit_price,quantity,line_total)
  values(v_id,(v_line->>'productId')::uuid,(v_line->>'variantId')::uuid,v_line->>'variantLabel',v_line->>'productName',
   (v_line->>'unitPrice')::numeric,(v_line->>'quantity')::integer,(v_line->>'lineTotal')::numeric);
 end loop;
 return query select v_id,v_reference,v_subtotal;
end;
$$;

create or replace function public.quote_order_savings(p_items jsonb,p_delivery_method text,p_coupon_code text default null,p_phone text default null,p_customer_user_id uuid default null)
returns table(subtotal numeric,discount_amount numeric,shipping_fee numeric,total numeric,code text,campaign_name text)
language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb; v_subtotal numeric(12,2); v_savings record;
begin
 v_snapshot:=private.checkout_catalog_snapshot(p_items,false); v_subtotal:=(v_snapshot->>'subtotal')::numeric;
 select * into v_savings from private.order_savings(v_snapshot->'lines',v_subtotal,p_delivery_method,p_coupon_code,p_phone,p_customer_user_id,false);
 return query select v_subtotal,v_savings.discount_amount,v_savings.shipping_fee,v_savings.total,v_savings.code,v_savings.campaign_name;
end;
$$;

create or replace function public.submit_order_request_with_auto_discounts(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,p_note text,p_items jsonb,
 p_pre_information_read boolean,p_privacy_notice_read boolean,p_notice_version text,p_delivery_method text,p_customer_user_id uuid,p_billing jsonb,p_coupon_code text)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,delivery_method text,discount_amount numeric,code text,campaign_name text)
language plpgsql security definer set search_path='' as $$
declare v_order record; v_lines jsonb; v_phone text; v_savings record;
begin
 select * into v_order from public.submit_order_request_with_billing(p_customer_name,p_phone,p_city,p_district,p_address,p_note,p_items,
  p_pre_information_read,p_privacy_notice_read,p_notice_version,p_delivery_method,p_customer_user_id,p_billing);
 if v_order.id is null then raise exception 'Sipariş kaydedilemedi.' using errcode='22023'; end if;
 select o.phone into v_phone from public.order_requests o where o.id=v_order.id;
 select coalesce(jsonb_agg(jsonb_build_object('productId',i.product_id,'categoryId',p.category_id,'lineTotal',i.line_total)),'[]'::jsonb)
 into v_lines from public.order_request_items i join public.products p on p.id=i.product_id where i.order_request_id=v_order.id;
 select * into v_savings from private.order_savings(v_lines,v_order.subtotal,v_order.delivery_method,p_coupon_code,v_phone,p_customer_user_id,true);
 if v_savings.discount_amount>0 then
  update public.order_requests o set discount_amount=v_savings.discount_amount,coupon_code=v_savings.code,
   automatic_campaign_id=v_savings.campaign_id,automatic_campaign_name=v_savings.campaign_name,
   shipping_fee=v_savings.shipping_fee,total=v_savings.total where o.id=v_order.id;
  if v_savings.code is not null then
   insert into public.coupon_redemptions(coupon_id,order_request_id,discount_amount)
   values(v_savings.coupon_id,v_order.id,v_savings.discount_amount);
  end if;
 end if;
 return query select v_order.id,v_order.reference,v_order.subtotal,v_savings.shipping_fee,v_savings.total,
  v_order.delivery_method,v_savings.discount_amount,v_savings.code,v_savings.campaign_name;
end;
$$;

-- Reassert the unchanged public RPC boundary after replacing their bodies.
revoke all on function public.submit_order_request(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.quote_order_savings(jsonb,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_order_request_with_auto_discounts(text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_order_request(text,text,text,text,text,text,jsonb),public.quote_order_savings(jsonb,text,text,text,uuid),
 public.submit_order_request_with_auto_discounts(text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb,text) to service_role;

create or replace function public.submit_order_request_with_delivery(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,p_note text,p_items jsonb,
 p_pre_information_read boolean,p_privacy_notice_read boolean,p_notice_version text,p_delivery_method text
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,delivery_method text)
language plpgsql security definer set search_path=''
as $function$
declare v_settings record; v_request record; v_fee numeric(12,2); v_total numeric(12,2);
begin
 select s.shipping_enabled,s.pickup_enabled,s.shipping_flat_fee,s.free_shipping_threshold,s.registered_address
 into v_settings from public.store_settings s where s.id=1 for share;
 if not found then raise exception 'Mağaza teslimat ayarları bulunamadı.' using errcode='22023'; end if;
 if p_delivery_method='shipping' then
  if not v_settings.shipping_enabled or v_settings.shipping_flat_fee is null then
   raise exception 'Kargo teslimatı şu anda kapalı.' using errcode='22023'; end if;
 elsif p_delivery_method='pickup' then
  if not v_settings.pickup_enabled then
   raise exception 'Mağazadan teslim şu anda kapalı.' using errcode='22023'; end if;
 else raise exception 'Teslimat seçimi geçersiz.' using errcode='22023'; end if;
 select * into v_request from public.submit_order_request_with_notices(
  p_customer_name,p_phone,
  case when p_delivery_method='pickup' then 'Mağaza' else p_city end,
  case when p_delivery_method='pickup' then 'Mağazadan teslim' else p_district end,
  case when p_delivery_method='pickup' then v_settings.registered_address else p_address end,
  p_note,p_items,p_pre_information_read,p_privacy_notice_read,p_notice_version
 );
 if v_request.id is null then raise exception 'Talep kaydedilemedi.' using errcode='22023'; end if;
 v_fee := private.order_shipping_fee(p_delivery_method,v_request.subtotal,0,true);
 v_total := v_request.subtotal+v_fee;
 update public.order_requests o
 set delivery_method=p_delivery_method,shipping_fee=v_fee,total=v_total
 where o.id=v_request.id;
 return query select v_request.id,v_request.reference,v_request.subtotal,v_fee,v_total,p_delivery_method;
end;
$function$;
revoke all on function public.submit_order_request_with_delivery(text,text,text,text,text,text,jsonb,boolean,boolean,text,text)
 from public,anon,authenticated;
grant execute on function public.submit_order_request_with_delivery(text,text,text,text,text,text,jsonb,boolean,boolean,text,text) to service_role;
