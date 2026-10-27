-- Recovered from the hosted migration ledger; original version retained.
create or replace function public.my_private_coupons()
returns table (
  code text, label text, discount_type text, discount_value numeric,
  max_discount numeric, min_subtotal numeric, expires_at timestamptz,
  starts_at timestamptz, is_active boolean, max_uses integer,
  max_uses_per_customer integer, used_count bigint, my_used_count bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Oturum açmalısınız.' using errcode='42501';
  end if;
  return query
    select c.code,c.label,c.discount_type,c.discount_value,
      c.max_discount,c.min_subtotal,c.expires_at,c.starts_at,c.is_active,
      c.max_uses,c.max_uses_per_customer,
      (select count(*) from public.coupon_redemptions r
        join public.order_requests o on o.id=r.order_request_id
        where r.coupon_id=c.id and o.status<>'cancelled'),
      (select count(*) from public.coupon_redemptions r
        join public.order_requests o on o.id=r.order_request_id
        where r.coupon_id=c.id and o.status<>'cancelled'
          and o.customer_user_id=(select auth.uid()))
    from public.coupon_private_assignments a
    join public.coupons c on c.id=a.coupon_id
    where a.user_id=(select auth.uid())
    order by a.created_at desc;
end;
$$;
revoke all on function public.my_private_coupons() from public,anon;
grant execute on function public.my_private_coupons() to authenticated;
