-- Recovered from the hosted migration ledger; original version retained.

create or replace function public.submit_order_request(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,p_note text,p_items jsonb
)
returns table(id uuid,reference text,subtotal numeric)
language plpgsql security definer set search_path=''
as $function$
declare
 v_name text:=trim(coalesce(p_customer_name,''));
 v_phone text:=trim(coalesce(p_phone,''));
 v_city text:=trim(coalesce(p_city,''));
 v_district text:=trim(coalesce(p_district,''));
 v_address text:=trim(coalesce(p_address,''));
 v_note text:=nullif(trim(coalesce(p_note,'')),'');
 v_new_id uuid:=gen_random_uuid();
 v_reference text:='OZ-'||upper(substr(replace(v_new_id::text,'-',''),1,12));
 v_subtotal numeric(12,2):=0;
 v_row jsonb;
 v_product_id uuid;
 v_variant_id uuid;
 v_variant_raw text;
 v_has_variants boolean;
 v_quantity integer;
 v_price numeric(12,2);
 v_product_name text;
 v_stock integer;
 v_label text;
 v_seen text[]:='{}';
 v_line_key text;
begin
 if char_length(v_name) not between 3 and 100
 or char_length(v_city) not between 2 and 80
 or char_length(v_district) not between 2 and 80
 or char_length(v_address) not between 10 and 500
 or char_length(coalesce(v_note,''))>500
 or v_phone !~ '^[+0-9 ()-]{10,20}$'
 or char_length(pg_catalog.regexp_replace(v_phone,'[^0-9]','','g')) not between 10 and 13
 then raise exception 'Teslimat bilgileri geçersiz.' using errcode='22023'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20
 then raise exception 'Sepet geçersiz.' using errcode='22023'; end if;
 v_phone:=pg_catalog.regexp_replace(v_phone,'[^0-9]','','g');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone,2099));
 if (select count(*) from public.order_requests where phone=v_phone and created_at>now()-interval '1 hour')>=3 then
  raise exception 'Çok fazla talep gönderildi. Daha sonra tekrar deneyin.' using errcode='22023';
 end if;
 for v_row in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_row)<>'object'
     or coalesce(v_row->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(v_row->>'quantity','') !~ '^[1-9][0-9]?$'
  then raise exception 'Sepette geçersiz ürün var.' using errcode='22023'; end if;
  v_product_id:=(v_row->>'productId')::uuid;
  v_quantity:=(v_row->>'quantity')::integer;
  v_variant_raw:=nullif(v_row->>'variantId','');
  if v_variant_raw is not null
     and v_variant_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'Geçersiz varyant kimliği.' using errcode='22023'; end if;
  v_variant_id:=case when v_variant_raw is null then null else v_variant_raw::uuid end;
  v_line_key:=v_product_id::text||':'||coalesce(v_variant_id::text,'standard');
  if v_line_key=any(v_seen) then raise exception 'Yinelenen sepet satırı.' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,v_line_key);
  select p.name,p.price,p.stock_quantity,p.has_variants
   into v_product_name,v_price,v_stock,v_has_variants
   from public.products p where p.id=v_product_id and p.is_active=true for share;
  if not found then raise exception 'Ürün artık satışta değil.' using errcode='22023'; end if;
  if v_has_variants and v_variant_id is null then
   raise exception 'Bu ürün için renk veya boyut seçmelisin.' using errcode='22023';
  end if;
  if not v_has_variants and v_variant_id is not null then
   raise exception 'Bu ürüne ait varyant bulunamadı.' using errcode='22023';
  end if;
  if v_variant_id is not null then
   select pv.price,pv.stock_quantity,
    concat_ws(' / ',nullif(pv.color,''),nullif(pv.size,''))
   into v_price,v_stock,v_label
   from public.product_variants pv
   where pv.id=v_variant_id and pv.product_id=v_product_id and pv.is_active=true for share;
   if not found then raise exception 'Seçilen varyant artık satışta değil.' using errcode='22023'; end if;
  end if;
  if v_stock<v_quantity then raise exception 'Seçilen ürün veya varyant için stok yetersiz.' using errcode='22023'; end if;
  v_subtotal:=v_subtotal+v_price*v_quantity;
  if v_subtotal>999999.99 then raise exception 'Sepet tutarı üst sınırı aşıyor.' using errcode='22023'; end if;
 end loop;
 insert into public.order_requests(id,reference,customer_name,phone,city,district,address,note,subtotal)
 values(v_new_id,v_reference,v_name,v_phone,v_city,v_district,v_address,v_note,v_subtotal);
 for v_row in select value from jsonb_array_elements(p_items) loop
  v_product_id:=(v_row->>'productId')::uuid;
  v_quantity:=(v_row->>'quantity')::integer;
  v_variant_raw:=nullif(v_row->>'variantId','');
  v_variant_id:=case when v_variant_raw is null then null else v_variant_raw::uuid end;
  select p.name,p.price into v_product_name,v_price from public.products p where p.id=v_product_id;
  v_label:=null;
  if v_variant_id is not null then
   select pv.price,concat_ws(' / ',nullif(pv.color,''),nullif(pv.size,''))
    into v_price,v_label from public.product_variants pv where pv.id=v_variant_id;
  end if;
  insert into public.order_request_items(
   order_request_id,product_id,variant_id,variant_label,product_name,unit_price,quantity,line_total
  ) values(v_new_id,v_product_id,v_variant_id,v_label,v_product_name,v_price,v_quantity,v_price*v_quantity);
 end loop;
 return query select v_new_id,v_reference,v_subtotal;
end;
$function$;
revoke all on function public.submit_order_request(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_order_request(text,text,text,text,text,text,jsonb) to service_role;
