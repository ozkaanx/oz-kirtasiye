-- Recovered from the hosted migration ledger; original version retained.

create or replace function public.submit_order_request_with_auto_discounts(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,
 p_note text,p_items jsonb,p_pre_information_read boolean,p_privacy_notice_read boolean,
 p_notice_version text,p_delivery_method text,p_customer_user_id uuid,p_billing jsonb,p_coupon_code text
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,
 delivery_method text,discount_amount numeric,code text,campaign_name text)
language plpgsql security definer set search_path=''
as $function$
declare
 v_order record;
 v_auto record;
 v_coupon record;
 v_lines jsonb;
 v_discount numeric(12,2):=0;
 v_campaign_id uuid;
 v_campaign_name text;
 v_code text;
 v_settings record;
 v_fee numeric(12,2);
 v_phone text;
begin
 select * into v_order from public.submit_order_request_with_billing(
  p_customer_name,p_phone,p_city,p_district,p_address,p_note,p_items,
  p_pre_information_read,p_privacy_notice_read,p_notice_version,p_delivery_method,p_customer_user_id,p_billing);
 if v_order.id is null then raise exception 'Sipariş kaydedilemedi.' using errcode='22023'; end if;
 select o.phone into v_phone from public.order_requests o where o.id=v_order.id;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'productId',i.product_id,'categoryId',p.category_id,'lineTotal',i.line_total)),'[]'::jsonb)
 into v_lines from public.order_request_items i join public.products p on p.id=i.product_id
 where i.order_request_id=v_order.id;
 select * into v_auto from private.best_automatic_campaign(v_lines,v_order.subtotal);
 if v_auto.campaign_id is not null then
   perform 1 from public.automatic_campaigns c
    where c.id=v_auto.campaign_id and c.is_active and now()>=c.starts_at
      and (c.expires_at is null or now()<c.expires_at) for share;
   if not found then raise exception 'Kampanya durumu değişti, tekrar dene.' using errcode='22023'; end if;
   v_campaign_id:=v_auto.campaign_id;
   v_campaign_name:=v_auto.campaign_name;
   v_discount:=v_auto.discount_amount;
 end if;
 if nullif(pg_catalog.btrim(coalesce(p_coupon_code,'')),'') is not null then
  select * into v_coupon from private.coupon_discount(
    p_coupon_code,v_order.subtotal,v_phone,p_customer_user_id,true);
  if v_coupon.amount>v_discount then
   v_discount:=v_coupon.amount;
   v_code:=v_coupon.code;
   v_campaign_id:=null;v_campaign_name:=null;
  end if;
 end if;
 if v_discount>0 then
  select s.shipping_enabled,s.pickup_enabled,s.shipping_flat_fee,s.free_shipping_threshold
    into v_settings from public.store_settings s where s.id=1 for share;
  if v_order.delivery_method='shipping' and v_settings.shipping_enabled then
   v_fee:=case when v_settings.free_shipping_threshold is not null and
      v_order.subtotal-v_discount>=v_settings.free_shipping_threshold then 0
      else v_settings.shipping_flat_fee end;
  elsif v_order.delivery_method='pickup' and v_settings.pickup_enabled then v_fee:=0;
  else raise exception 'Teslimat seçimi artık geçerli değil.' using errcode='22023'; end if;
  update public.order_requests o
    set discount_amount=v_discount,coupon_code=v_code,
        automatic_campaign_id=v_campaign_id,automatic_campaign_name=v_campaign_name,
        shipping_fee=v_fee,total=v_order.subtotal-v_discount+v_fee
  where o.id=v_order.id;
  if v_code is not null then
   insert into public.coupon_redemptions(coupon_id,order_request_id,discount_amount)
     values(v_coupon.coupon_id,v_order.id,v_discount);
  end if;
 else
  v_fee:=v_order.shipping_fee;
 end if;
 return query select v_order.id,v_order.reference,v_order.subtotal,v_fee,
  v_order.subtotal-v_discount+v_fee,v_order.delivery_method,v_discount,v_code,v_campaign_name;
end;
$function$;
revoke all on function public.submit_order_request_with_auto_discounts(
 text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb,text
) from public,anon,authenticated;
grant execute on function public.submit_order_request_with_auto_discounts(
 text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb,text
) to service_role;
