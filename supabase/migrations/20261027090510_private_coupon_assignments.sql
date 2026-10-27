-- Recovered from the hosted migration ledger; original version retained.
create table if not exists public.coupon_private_assignments (
 coupon_id uuid primary key references public.coupons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists coupon_private_assignments_user_idx on public.coupon_private_assignments(user_id);
alter table public.coupon_private_assignments enable row level security;
create policy "customer sees own assigned coupon" on public.coupon_private_assignments for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.store_admins where user_id=(select auth.uid())));
create policy "admin assigns coupons" on public.coupon_private_assignments for insert to authenticated with check (exists(select 1 from public.store_admins where user_id=(select auth.uid())));
create policy "admin changes assignments" on public.coupon_private_assignments for update to authenticated using (exists(select 1 from public.store_admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.store_admins where user_id=(select auth.uid())));
create policy "admin removes assignments" on public.coupon_private_assignments for delete to authenticated using (exists(select 1 from public.store_admins where user_id=(select auth.uid())));
grant select,insert,update,delete on public.coupon_private_assignments to authenticated;
alter function private.coupon_discount(text,numeric,text,uuid,boolean) rename to coupon_discount_unrestricted;
create function private.coupon_discount(p_code text,p_subtotal numeric,p_phone text,p_user_id uuid,p_lock boolean default false)
returns table(coupon_id uuid,code text,amount numeric)
language plpgsql security invoker set search_path = '' as $$
declare v_coupon_id uuid; v_assignee uuid;
begin
 select c.id into v_coupon_id from public.coupons c where c.code=upper(pg_catalog.btrim(coalesce(p_code,'')));
 if v_coupon_id is not null then
  select a.user_id into v_assignee from public.coupon_private_assignments a where a.coupon_id=v_coupon_id;
  if v_assignee is not null and ((select auth.uid()) is null or (select auth.uid())<>v_assignee or p_user_id is distinct from v_assignee) then
    raise exception 'Bu kupon yalnızca atandığı müşteri hesabıyla kullanılabilir.' using errcode='22023';
  end if;
 end if;
 return query select t.coupon_id,t.code,t.amount from private.coupon_discount_unrestricted(p_code,p_subtotal,p_phone,p_user_id,p_lock) t;
end; $$;
revoke all on function private.coupon_discount(text,numeric,text,uuid,boolean) from public,anon,authenticated;
