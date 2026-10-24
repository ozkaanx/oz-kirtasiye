-- Already deployed to Öz Kırtasiye's Supabase project.
-- This file version-controls the admin-only reporting function; do not manually rerun on production.
create or replace function public.admin_dashboard_summary(p_days integer default 30)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_since timestamptz;
  v_today date;
  v_result jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_admins a where a.user_id = (select auth.uid())
  ) then raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501'; end if;
  if p_days not between 7 and 90 then
    raise exception 'Rapor dönemi 7–90 gün arasında olmalı.' using errcode = '22023';
  end if;
  v_since := now() - pg_catalog.make_interval(days => p_days);
  v_today := (now() at time zone 'Europe/Istanbul')::date;
  select pg_catalog.jsonb_build_object(
    'totalProducts', (select count(*) from public.products),
    'activeProducts', (select count(*) from public.products where is_active),
    'totalStockUnits', (select coalesce(sum(stock_quantity),0) from public.products where is_active),
    'lowStockProducts', (select count(*) from public.products
      where is_active and stock_quantity > 0 and stock_quantity <= low_stock_threshold),
    'outOfStockProducts', (select count(*) from public.products where is_active and stock_quantity = 0),
    'totalRequests', (select count(*) from public.order_requests),
    'newRequests', (select count(*) from public.order_requests where status = 'new'),
    'processingRequests', (select count(*) from public.order_requests where status = 'processing'),
    'shippingRequests', (select count(*) from public.order_requests where status = 'shipped'),
    'deliveredRequests', (select count(*) from public.order_requests where status in ('delivered','completed')),
    'cancelledRequests', (select count(*) from public.order_requests where status = 'cancelled'),
    'periodRequests', (select count(*) from public.order_requests where created_at >= v_since),
    'periodRequestedTotal', (select coalesce(sum(total),0) from public.order_requests
      where created_at >= v_since and status <> 'cancelled'),
    'dailyRequests', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'date', d.day::date::text,
          'count', coalesce(orders.request_count,0),
          'amount', coalesce(orders.requested_total,0)
        ) order by d.day
      ), '[]'::jsonb)
      from pg_catalog.generate_series((v_today-13)::timestamp,v_today::timestamp,interval '1 day') as d(day)
      left join lateral (
        select count(*) as request_count,
          coalesce(sum(o.total) filter (where o.status <> 'cancelled'),0) as requested_total
        from public.order_requests o
        where (o.created_at at time zone 'Europe/Istanbul')::date = d.day::date
      ) orders on true
    ),
    'topRequestedProducts', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('name', ranked.product_name,'quantity', ranked.total_quantity)
        order by ranked.total_quantity desc, ranked.product_name), '[]'::jsonb)
      from (
        select i.product_name, sum(i.quantity)::integer as total_quantity
        from public.order_request_items i
        join public.order_requests o on o.id = i.order_request_id
        where o.created_at >= v_since and o.status <> 'cancelled'
        group by i.product_name
        order by sum(i.quantity) desc, i.product_name
        limit 5
      ) ranked
    )
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.admin_dashboard_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_dashboard_summary(integer) to authenticated;
