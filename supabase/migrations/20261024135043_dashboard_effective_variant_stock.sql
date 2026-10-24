-- Preserve all dashboard metrics while aggregating active variant stock for variant products.
do $do$
declare src text; changed text;
begin
 select pg_get_functiondef('public.admin_dashboard_summary(integer)'::regprocedure) into src;
 changed:=replace(src,
  '''totalStockUnits'', (select coalesce(sum(stock_quantity),0) from public.products where is_active)',
  '''totalStockUnits'', (select coalesce(sum(case when p.has_variants then (select sum(v.stock_quantity) from public.product_variants v where v.product_id=p.id and v.is_active) else p.stock_quantity end),0) from public.products p where p.is_active)');
 changed:=replace(changed,
  'where is_active and stock_quantity > 0 and stock_quantity <= low_stock_threshold)',
  'where is_active and (case when has_variants then (select coalesce(sum(v.stock_quantity),0) from public.product_variants v where v.product_id=products.id and v.is_active) else stock_quantity end) > 0 and (case when has_variants then (select coalesce(sum(v.stock_quantity),0) from public.product_variants v where v.product_id=products.id and v.is_active) else stock_quantity end) <= low_stock_threshold)');
 changed:=replace(changed,
  'where is_active and stock_quantity = 0)',
  'where is_active and (case when has_variants then (select coalesce(sum(v.stock_quantity),0) from public.product_variants v where v.product_id=products.id and v.is_active) else stock_quantity end) = 0)');
 if changed=src then raise exception 'Dashboard stock calculation anchors not found'; end if;
 execute changed;
end $do$;
