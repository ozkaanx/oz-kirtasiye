-- Öz Kırtasiye - manual coupon offers, secure checkout and immutable order snapshot.
-- Already applied to hosted database (migration 20261024142130). Do not execute manually again.
-- Coupon validation occurs on the server.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[A-Z0-9_-]{4,32}$'),
  label text not null check(char_length(btrim(label)) between 3 and 100),
  discount_type text not null check(discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check(discount_value>0 and discount_value<=999999.99),
  max_discount numeric(12,2) check(max_discount is null or max_discount>0),
  min_subtotal numeric(12,2) not null default 0 check(min_subtotal>=0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check(max_uses is null or max_uses between 1 and 100000),
  max_uses_per_customer integer not null default 1 check(max_uses_per_customer between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint coupon_valid_percent check(discount_type<>'percent' or discount_value<=100),
  constraint coupon_valid_window check(expires_at is null or expires_at>starts_at)
);
create index coupons_active_window_idx on public.coupons(is_active,starts_at,expires_at);

alter table public.order_requests
 add column discount_amount numeric(12,2) not null default 0,
 add column coupon_code text;
alter table public.order_requests
 add constraint order_requests_discount_amount_check check(discount_amount>=0 and discount_amount<=subtotal),
 add constraint order_requests_coupon_snapshot_check check(
   (coupon_code is null and discount_amount=0)
   or (coupon_code is not null and discount_amount>0)
 );
alter table public.order_requests drop constraint order_requests_total_check;
alter table public.order_requests add constraint order_requests_total_check
 check(total=subtotal-discount_amount+shipping_fee);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_request_id uuid not null unique references public.order_requests(id) on delete restrict,
  discount_amount numeric(12,2) not null check(discount_amount>0),
  created_at timestamptz not null default now()
);
create index coupon_redemptions_by_coupon on public.coupon_redemptions(coupon_id);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons, public.coupon_redemptions from public, anon, authenticated;
grant select, insert, update on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
create policy coupons_admin_select on public.coupons for select to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy coupons_admin_insert on public.coupons for insert to authenticated
 with check(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy coupons_admin_update on public.coupons for update to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())))
 with check(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy redemptions_admin_read on public.coupon_redemptions for select to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));

-- Called only from server-only SECURITY DEFINER RPCs. Private schema is not exposed to API.
-- In coupon checkout, p_lock=true serializes claims on the same coupon row.
create or replace function private.coupon_discount(
 p_code text, p_subtotal numeric, p_phone text, p_user_id uuid, p_lock boolean default false
)
returns table(coupon_id uuid, code text, amount numeric)
language plpgsql security invoker set search_path=''
as $function$
declare
 v_coupon public.coupons%rowtype;
 v_used bigint;
 v_person_used bigint;
 v_phone text := nullif(pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'');
 v_normal_code text := upper(btrim(coalesce(p_code,'')));
 v_discount numeric(12,2);
begin
 if v_normal_code !~ '^[A-Z0-9_-]{4,32}$' then
  raise exception 'Kupon kodu 4-32 karakter olmalı.' using errcode='22023';
 end if;
 if p_lock then
  select * into v_coupon from public.coupons c where c.code=v_normal_code for update;
 else
  select * into v_coupon from public.coupons c where c.code=v_normal_code;
 end if;
 if not found or not v_coupon.is_active or now()<v_coupon.starts_at or
    (v_coupon.expires_at is not null and now()>=v_coupon.expires_at) then
  raise exception 'Kupon bulunamadı veya geçerli değil.' using errcode='22023';
 end if;
 if p_subtotal < v_coupon.min_subtotal then
  raise exception 'Bu kupon için ürün toplamı en az % TL olmalı.',v_coupon.min_subtotal using errcode='22023';
 end if;
 select count(*) into v_used from public.coupon_redemptions r
 join public.order_requests o on o.id=r.order_request_id
 where r.coupon_id=v_coupon.id and o.status<>'cancelled';
 if v_coupon.max_uses is not null and v_used>=v_coupon.max_uses then
  raise exception 'Kupon kullanım limiti doldu.' using errcode='22023';
 end if;
 if v_phone is not null or p_user_id is not null then
  select count(*) into v_person_used from public.coupon_redemptions r
  join public.order_requests o on o.id=r.order_request_id
  where r.coupon_id=v_coupon.id and o.status<>'cancelled'
    and ((v_phone is not null and o.phone=v_phone)
      or (p_user_id is not null and o.customer_user_id=p_user_id));
  if v_person_used>=v_coupon.max_uses_per_customer then
   raise exception 'Bu kupon için müşteri kullanım limitine ulaşıldı.' using errcode='22023';
  end if;
 end if;
 v_discount := case when v_coupon.discount_type='percent'
  then round(p_subtotal*v_coupon.discount_value/100,2)
  else v_coupon.discount_value end;
 if v_coupon.max_discount is not null then
  v_discount := least(v_discount,v_coupon.max_discount);
 end if;
 v_discount := least(v_discount,p_subtotal);
 if v_discount<=0 then
  raise exception 'Kupon bu sepete indirim uygulayamıyor.' using errcode='22023';
 end if;
 return query select v_coupon.id,v_coupon.code,v_discount;
end;
$function$;
revoke all on function private.coupon_discount(text,numeric,text,uuid,boolean) from public,anon,authenticated;

-- Non-mutating authoritative quote, not an invoice or a reservation.
-- No trust is placed in browser-supplied prices, stock, or customer identity.
create or replace function public.quote_order_coupon(
 p_items jsonb,p_delivery_method text,p_coupon_code text,p_phone text default null,p_customer_user_id uuid default null
)
returns table(subtotal numeric,discount_amount numeric,shipping_fee numeric,total numeric,code text)
language plpgsql security definer set search_path=''
as $function$
declare
 v_subtotal numeric(12,2):=0;
 v_row jsonb;
 v_product_id uuid;
 v_variant_id uuid;
 v_variant_str text;
 v_price numeric(12,2);
 v_stock integer;
 v_qty integer;
 v_has_variants boolean;
 v_seen text[]:='{}';
 v_key text;
 v_coupon record;
 v_settings record;
 v_fee numeric(12,2);
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20 then
  raise exception 'Sepet geçersiz.' using errcode='22023'; end if;
 for v_row in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_row)<>'object' or
     coalesce(v_row->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
     coalesce(v_row->>'quantity','') !~ '^[1-9][0-9]?$' then
   raise exception 'Sepet satırı geçersiz.' using errcode='22023'; end if;
  v_product_id:=(v_row->>'productId')::uuid;
  v_qty:=(v_row->>'quantity')::integer;
  v_variant_str:=nullif(v_row->>'variantId','');
  if v_variant_str is not null and
    v_variant_str !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'Sepet varyantı geçersiz.' using errcode='22023'; end if;
  v_variant_id:=case when v_variant_str is null then null else v_variant_str::uuid end;
  v_key:=v_product_id::text||':'||coalesce(v_variant_id::text,'standard');
  if v_key=any(v_seen) then raise exception 'Yinelenen ürün.' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,v_key);
  select p.price,p.stock_quantity,p.has_variants into v_price,v_stock,v_has_variants
   from public.products p where p.id=v_product_id and p.is_active;
  if not found or (v_has_variants and v_variant_id is null)
    or (not v_has_variants and v_variant_id is not null) then
   raise exception 'Ürün veya varyant satışta değil.' using errcode='22023'; end if;
  if v_variant_id is not null then
   select v.price,v.stock_quantity into v_price,v_stock from public.product_variants v
    where v.id=v_variant_id and v.product_id=v_product_id and v.is_active;
   if not found then raise exception 'Seçilen varyant satışta değil.' using errcode='22023'; end if;
  end if;
  if v_stock<v_qty then raise exception 'Stok yetersiz.' using errcode='22023'; end if;
  v_subtotal:=v_subtotal+v_qty*v_price;
  if v_subtotal>999999.99 then raise exception 'Sepet tutarı sınırı aşıyor.' using errcode='22023'; end if;
 end loop;
 select * into v_coupon from private.coupon_discount(p_coupon_code,v_subtotal,p_phone,p_customer_user_id,false);
 if v_coupon.coupon_id is null then raise exception 'Kupon geçersiz.' using errcode='22023'; end if;
 select shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold
 into v_settings from public.store_settings where id=1;
 if p_delivery_method='shipping' and v_settings.shipping_enabled then
  v_fee:=case when v_settings.free_shipping_threshold is not null
   and v_subtotal-v_coupon.amount>=v_settings.free_shipping_threshold
   then 0 else v_settings.shipping_flat_fee end;
 elsif p_delivery_method='pickup' and v_settings.pickup_enabled then v_fee:=0;
 else raise exception 'Teslimat seçeneği şu anda aktif değil.' using errcode='22023'; end if;
 return query select v_subtotal,v_coupon.amount,v_fee,(v_subtotal-v_coupon.amount+v_fee),v_coupon.code;
end;
$function$;
revoke all on function public.quote_order_coupon(jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.quote_order_coupon(jsonb,text,text,text,uuid) to service_role;

-- Existing billing + checkout remains unchanged for no-coupon requests.
-- New wrapper makes the original order and coupon redemption a single atomic transaction.
create or replace function public.submit_order_request_with_billing_and_coupon(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,
 p_note text,p_items jsonb,p_pre_information_read boolean,p_privacy_notice_read boolean,
 p_notice_version text,p_delivery_method text,p_customer_user_id uuid,p_billing jsonb,p_coupon_code text
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,delivery_method text,discount_amount numeric,code text)
language plpgsql security definer set search_path=''
as $function$
declare
 v_order record;
 v_coupon record;
 v_settings record;
 v_fee numeric(12,2);
 v_phone text;
begin
 select * into v_order from public.submit_order_request_with_billing(
  p_customer_name,p_phone,p_city,p_district,p_address,p_note,p_items,
  p_pre_information_read,p_privacy_notice_read,p_notice_version,p_delivery_method,p_customer_user_id,p_billing
 );
 if v_order.id is null then raise exception 'Sipariş kaydedilemedi.' using errcode='22023'; end if;
 if nullif(btrim(coalesce(p_coupon_code,'')),'') is null then
  return query select v_order.id,v_order.reference,v_order.subtotal,v_order.shipping_fee,
   v_order.total,v_order.delivery_method,0::numeric,null::text;
  return;
 end if;
 select phone into v_phone from public.order_requests where order_requests.id=v_order.id;
 select * into v_coupon from private.coupon_discount(p_coupon_code,v_order.subtotal,v_phone,p_customer_user_id,true);
 if v_coupon.coupon_id is null then raise exception 'Kupon uygulanamadı.' using errcode='22023'; end if;
 select shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold into v_settings
  from public.store_settings where store_settings.id=1 for share;
 if v_order.delivery_method='shipping' and v_settings.shipping_enabled then
  v_fee:=case when v_settings.free_shipping_threshold is not null
    and v_order.subtotal-v_coupon.amount>=v_settings.free_shipping_threshold
    then 0 else v_settings.shipping_flat_fee end;
 elsif v_order.delivery_method='pickup' and v_settings.pickup_enabled then v_fee:=0;
 else raise exception 'Teslimat seçimi artık geçerli değil.' using errcode='22023'; end if;
 update public.order_requests o
 set discount_amount=v_coupon.amount,coupon_code=v_coupon.code,
     shipping_fee=v_fee,total=v_order.subtotal-v_coupon.amount+v_fee
 where o.id=v_order.id;
 insert into public.coupon_redemptions(coupon_id,order_request_id,discount_amount)
 values(v_coupon.coupon_id,v_order.id,v_coupon.amount);
 return query select v_order.id,v_order.reference,v_order.subtotal,v_fee,
  (v_order.subtotal-v_coupon.amount+v_fee),v_order.delivery_method,v_coupon.amount,v_coupon.code;
end;
$function$;
revoke all on function public.submit_order_request_with_billing_and_coupon(
 text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb,text
) from public,anon,authenticated;
grant execute on function public.submit_order_request_with_billing_and_coupon(
 text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb,text
) to service_role;
