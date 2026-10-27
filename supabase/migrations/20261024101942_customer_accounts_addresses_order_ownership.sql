-- Recovered from the hosted migration ledger; original version retained.

create table if not exists public.customer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (char_length(full_name)<=100),
 phone text check (phone is null or char_length(phone) between 10 and 20),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.customer_addresses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null default 'Ev' check(char_length(label) between 1 and 40),
 recipient_name text not null check(char_length(recipient_name) between 3 and 100),
 phone text not null check(char_length(phone) between 10 and 20),
 city text not null check(char_length(city) between 2 and 80),
 district text not null check(char_length(district) between 2 and 80),
 address text not null check(char_length(address) between 10 and 500),
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customer_addresses_owner_created_idx on public.customer_addresses(user_id,created_at desc);
create unique index if not exists customer_addresses_one_default_idx on public.customer_addresses(user_id) where is_default;
create trigger customer_profiles_updated_at before update on public.customer_profiles
 for each row execute function private.touch_updated_at();
create trigger customer_addresses_updated_at before update on public.customer_addresses
 for each row execute function private.touch_updated_at();
alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
revoke all on public.customer_profiles,public.customer_addresses from public,anon,authenticated;
grant select,insert,update,delete on public.customer_profiles,public.customer_addresses to authenticated;
create policy "customer_profile_select_self" on public.customer_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy "customer_profile_insert_self" on public.customer_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy "customer_profile_update_self" on public.customer_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "customer_profile_delete_self" on public.customer_profiles for delete to authenticated using(user_id=(select auth.uid()));
create policy "customer_address_select_self" on public.customer_addresses for select to authenticated using(user_id=(select auth.uid()));
create policy "customer_address_insert_self" on public.customer_addresses for insert to authenticated with check(user_id=(select auth.uid()) and is_default=false);
create policy "customer_address_update_self" on public.customer_addresses for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "customer_address_delete_self" on public.customer_addresses for delete to authenticated using(user_id=(select auth.uid()));
create or replace function public.set_default_customer_address(p_address_id uuid)
returns void language plpgsql security invoker set search_path=''
as $function$
begin
 if (select auth.uid()) is null then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
 -- Same customer serialized via auth.users row; prevents two concurrent default switches.
 perform 1 from auth.users where id=(select auth.uid()) for update;
 if not exists(select 1 from public.customer_addresses where id=p_address_id and user_id=(select auth.uid())) then
   raise exception 'Adres bulunamadı.' using errcode='22023';
 end if;
 update public.customer_addresses set is_default=false where user_id=(select auth.uid()) and is_default=true;
 update public.customer_addresses set is_default=true where id=p_address_id and user_id=(select auth.uid());
end;
$function$;
revoke all on function public.set_default_customer_address(uuid) from public,anon,authenticated;
grant execute on function public.set_default_customer_address(uuid) to authenticated;
alter table public.order_requests add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create index if not exists order_requests_customer_created_idx on public.order_requests(customer_user_id,created_at desc);
create policy "order_requests_customer_select" on public.order_requests for select to authenticated using(customer_user_id=(select auth.uid()));
create policy "order_items_customer_select" on public.order_request_items for select to authenticated
 using(exists(select 1 from public.order_requests r where r.id=order_request_id and r.customer_user_id=(select auth.uid())));
create or replace function public.submit_order_request_with_delivery_for_customer(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,p_note text,p_items jsonb,
 p_pre_information_read boolean,p_privacy_notice_read boolean,p_notice_version text,p_delivery_method text,
 p_customer_user_id uuid
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,delivery_method text)
language plpgsql security definer set search_path=''
as $function$
declare v_order record;
begin
 if p_customer_user_id is not null and not exists (select 1 from auth.users u where u.id=p_customer_user_id) then
  raise exception 'Geçersiz müşteri.' using errcode='22023';
 end if;
 select * into v_order from public.submit_order_request_with_delivery(
  p_customer_name,p_phone,p_city,p_district,p_address,p_note,p_items,p_pre_information_read,p_privacy_notice_read,p_notice_version,p_delivery_method
 );
 if v_order.id is null then raise exception 'Sipariş talebi oluşturulamadı.' using errcode='22023'; end if;
 if p_customer_user_id is not null then
  update public.order_requests o set customer_user_id=p_customer_user_id where o.id=v_order.id;
 end if;
 return query select v_order.id,v_order.reference,v_order.subtotal,v_order.shipping_fee,v_order.total,v_order.delivery_method;
end;
$function$;
revoke all on function public.submit_order_request_with_delivery_for_customer(text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.submit_order_request_with_delivery_for_customer(text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid) to service_role;
