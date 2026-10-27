-- Recovered from the hosted migration ledger; original version retained.
create or replace function public.admin_crm_customers()
returns table(user_id uuid, email text, full_name text, phone text, registered_at timestamptz, order_count bigint, completed_count bigint, requested_total numeric, last_order_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 return query
 select u.id, u.email::text, coalesce(nullif(p.full_name,''), o.last_name, split_part(u.email,'@',1))::text,
        coalesce(nullif(p.phone,''), o.last_phone)::text, u.created_at,
        coalesce(o.n,0)::bigint, coalesce(o.completed_n,0)::bigint, coalesce(o.amount,0)::numeric, o.last_at
 from auth.users u
 left join public.customer_profiles p on p.user_id=u.id
 left join lateral (
   select count(*)::bigint as n,
     count(*) filter (where r.status in ('delivered','completed'))::bigint as completed_n,
     coalesce(sum(r.total) filter (where r.status <> 'cancelled'),0)::numeric as amount,
     max(r.created_at) as last_at,
     (array_agg(r.customer_name order by r.created_at desc))[1] as last_name,
     (array_agg(r.phone order by r.created_at desc))[1] as last_phone
   from public.order_requests r where r.customer_user_id=u.id
 ) o on true
 order by u.created_at desc
 limit 5000;
end;
$$;
revoke all on function public.admin_crm_customers() from public,anon;
grant execute on function public.admin_crm_customers() to authenticated;
