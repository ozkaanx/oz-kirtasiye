-- Recovered from the hosted migration ledger; original version retained.

create or replace function public.admin_coupon_usage()
returns table(coupon_id uuid, used_count bigint)
language sql security invoker set search_path=''
as $function$
 select c.id, count(o.id)::bigint
 from public.coupons c
 left join public.coupon_redemptions r on r.coupon_id=c.id
 left join public.order_requests o on o.id=r.order_request_id and o.status<>'cancelled'
 where (select auth.uid()) is not null and exists (
  select 1 from public.store_admins a where a.user_id=(select auth.uid())
 )
 group by c.id;
$function$;
revoke all on function public.admin_coupon_usage() from public,anon,authenticated;
grant execute on function public.admin_coupon_usage() to authenticated;
