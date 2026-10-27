-- Recovered from the hosted migration ledger; original version retained.

alter table public.store_settings
 add column if not exists shipping_enabled boolean not null default false,
 add column if not exists pickup_enabled boolean not null default false,
 add column if not exists shipping_flat_fee numeric(12,2),
 add column if not exists free_shipping_threshold numeric(12,2),
 add column if not exists pickup_instructions text;
alter table public.store_settings
 add constraint store_settings_shipping_nonnegative check(shipping_flat_fee is null or shipping_flat_fee between 0 and 99999.99),
 add constraint store_settings_threshold_nonnegative check(free_shipping_threshold is null or free_shipping_threshold between 0 and 999999.99),
 add constraint store_settings_shipping_requires_fee check(not shipping_enabled or shipping_flat_fee is not null),
 add constraint store_settings_pickup_instructions_length check(pickup_instructions is null or char_length(pickup_instructions)<=1000);
alter table public.order_requests
 add column if not exists delivery_method text not null default 'legacy',
 add column if not exists shipping_fee numeric(12,2) not null default 0,
 add column if not exists total numeric(12,2) not null default 0;
update public.order_requests set total=subtotal where total=0 and subtotal<>0;
alter table public.order_requests
 add constraint order_requests_delivery_method_check check(delivery_method in ('legacy','shipping','pickup')),
 add constraint order_requests_shipping_fee_nonnegative check(shipping_fee>=0),
 add constraint order_requests_total_check check(total=subtotal+shipping_fee);
create or replace function public.submit_order_request_with_delivery(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,p_note text,p_items jsonb,
 p_pre_information_read boolean,p_privacy_notice_read boolean,p_notice_version text,p_delivery_method text
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,delivery_method text)
language plpgsql security definer set search_path=''
as $function$
declare v_settings record; v_request record; v_fee numeric(12,2); v_total numeric(12,2);
begin
 select shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold,registered_address
 into v_settings from public.store_settings where id=1 for share;
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
 v_fee := case
  when p_delivery_method='pickup' then 0
  when v_settings.free_shipping_threshold is not null and v_request.subtotal>=v_settings.free_shipping_threshold then 0
  else v_settings.shipping_flat_fee end;
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
create or replace function private.prevent_shipping_for_pickup()
returns trigger language plpgsql set search_path=''
as $function$
begin
 if old.delivery_method='pickup' and new.status='shipped' then
  raise exception 'Mağazadan teslim sipariş kargoya verilemez.' using errcode='22023';
 end if;
 return new;
end;
$function$;
revoke all on function private.prevent_shipping_for_pickup() from public,anon,authenticated;
create trigger order_requests_pickup_shipping_guard before update on public.order_requests
 for each row execute function private.prevent_shipping_for_pickup();
create or replace function public.complete_pickup_order(p_order_id uuid)
returns text language plpgsql security invoker set search_path=''
as $function$
declare v_status text; v_method text; v_deducted timestamptz;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.store_admins where user_id=(select auth.uid())
 ) then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 select status,delivery_method,inventory_deducted_at into v_status,v_method,v_deducted
 from public.order_requests where id=p_order_id for update;
 if not found then raise exception 'Sipariş bulunamadı.' using errcode='22023'; end if;
 if v_method<>'pickup' or v_status<>'processing' or v_deducted is null then
  raise exception 'Yalnızca hazırlanan mağazadan teslim siparişi teslim edilebilir.' using errcode='22023';
 end if;
 update public.order_requests set status='delivered',delivered_at=now() where id=p_order_id;
 insert into public.order_request_status_history(order_request_id,from_status,to_status,note,changed_by)
 values(p_order_id,v_status,'delivered','Mağazadan teslim edildi.',(select auth.uid()));
 return 'delivered';
end;
$function$;
revoke all on function public.complete_pickup_order(uuid) from public,anon,authenticated;
grant execute on function public.complete_pickup_order(uuid) to authenticated;
