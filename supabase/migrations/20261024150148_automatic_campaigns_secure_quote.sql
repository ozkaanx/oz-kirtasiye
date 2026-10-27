-- Recovered from the hosted migration ledger; original version retained.

create or replace function public.quote_order_savings(
 p_items jsonb,p_delivery_method text,p_coupon_code text default null,
 p_phone text default null,p_customer_user_id uuid default null
)
returns table(subtotal numeric,discount_amount numeric,shipping_fee numeric,total numeric,code text,campaign_name text)
language plpgsql security definer set search_path=''
as $function$
declare
 v_subtotal numeric(12,2):=0;
 v_lines jsonb:='[]'::jsonb;
 v_row jsonb;
 v_product_id uuid;
 v_variant_id uuid;
 v_variant_string text;
 v_category_id uuid;
 v_price numeric(12,2);
 v_stock integer;
 v_qty integer;
 v_has_variants boolean;
 v_seen text[]:='{}';
 v_key text;
 v_auto record;
 v_coupon record;
 v_discount numeric(12,2):=0;
 v_name text;
 v_code text;
 v_settings record;
 v_fee numeric(12,2);
begin
 if p_items is null or pg_catalog.jsonb_typeof(p_items)<>'array'
  or pg_catalog.jsonb_array_length(p_items) not between 1 and 20
 then raise exception 'Sepet geçersiz.' using errcode='22023'; end if;
 for v_row in select value from pg_catalog.jsonb_array_elements(p_items) loop
  if pg_catalog.jsonb_typeof(v_row)<>'object'
   or coalesce(v_row->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or coalesce(v_row->>'quantity','') !~ '^[1-9][0-9]?$'
  then raise exception 'Sepet satırı geçersiz.' using errcode='22023'; end if;
  v_product_id:=(v_row->>'productId')::uuid;
  v_qty:=(v_row->>'quantity')::integer;
  v_variant_string:=nullif(v_row->>'variantId','');
  if v_variant_string is not null and
   v_variant_string !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'Geçersiz varyant.' using errcode='22023'; end if;
  v_variant_id:=case when v_variant_string is null then null else v_variant_string::uuid end;
  v_key:=v_product_id::text||':'||coalesce(v_variant_id::text,'standard');
  if v_key=any(v_seen) then raise exception 'Yinelenen sepet satırı.' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,v_key);
  select p.price,p.stock_quantity,p.has_variants,p.category_id
   into v_price,v_stock,v_has_variants,v_category_id
   from public.products p where p.id=v_product_id and p.is_active=true;
  if not found or (v_has_variants and v_variant_id is null)
   or (not v_has_variants and v_variant_id is not null)
  then raise exception 'Ürün satışta değil.' using errcode='22023'; end if;
  if v_variant_id is not null then
   select v.price,v.stock_quantity into v_price,v_stock from public.product_variants v
   where v.id=v_variant_id and v.product_id=v_product_id and v.is_active=true;
   if not found then raise exception 'Varyant satışta değil.' using errcode='22023'; end if;
  end if;
  if v_stock<v_qty then raise exception 'Stok yetersiz.' using errcode='22023'; end if;
  v_subtotal:=v_subtotal+v_price*v_qty;
  if v_subtotal>999999.99 then raise exception 'Sepet tutarı sınırı aşıyor.' using errcode='22023'; end if;
  v_lines:=v_lines || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
   'productId',v_product_id,'categoryId',v_category_id,'lineTotal',v_price*v_qty));
 end loop;
 select * into v_auto from private.best_automatic_campaign(v_lines,v_subtotal);
 if v_auto.campaign_id is not null then
  v_discount:=v_auto.discount_amount;
  v_name:=v_auto.campaign_name;
 end if;
 if nullif(pg_catalog.btrim(coalesce(p_coupon_code,'')),'') is not null then
  select * into v_coupon from private.coupon_discount(
   p_coupon_code,v_subtotal,p_phone,p_customer_user_id,false);
  if v_coupon.amount>v_discount then
   v_discount:=v_coupon.amount;v_code:=v_coupon.code;v_name:=null;
  end if;
 end if;
 select s.shipping_enabled,s.pickup_enabled,s.shipping_flat_fee,s.free_shipping_threshold
 into v_settings from public.store_settings s where s.id=1;
 if p_delivery_method='shipping' and v_settings.shipping_enabled then
  v_fee:=case when v_settings.free_shipping_threshold is not null and
   v_subtotal-v_discount>=v_settings.free_shipping_threshold then 0 else v_settings.shipping_flat_fee end;
 elsif p_delivery_method='pickup' and v_settings.pickup_enabled then v_fee:=0;
 else raise exception 'Teslimat seçeneği şu anda aktif değil.' using errcode='22023'; end if;
 return query select v_subtotal,v_discount,v_fee,v_subtotal-v_discount+v_fee,v_code,v_name;
end;
$function$;
revoke all on function public.quote_order_savings(jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.quote_order_savings(jsonb,text,text,text,uuid) to service_role;
