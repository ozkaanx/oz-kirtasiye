begin;

create function pg_temp.assert_true(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.expect_error(statement text, expected_code text, label text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_code then
      raise notice 'PASS: %', label;
      return;
    end if;
    raise;
  end;
  raise exception 'FAIL: %', label;
end;
$$;

insert into public.categories(id, name, slug, parent_id) values
('97000000-0000-0000-0000-000000000001', 'Catalog Root', 'catpage-root', null),
('97000000-0000-0000-0000-000000000002', 'Catalog Child', 'catpage-child',
 '97000000-0000-0000-0000-000000000001');

insert into public.products(id, name, slug, price, stock_quantity, category_id, is_active, has_variants)
select ('98000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'CATPAGEFIXTURE Pencil ' || n, 'catpage-product-' || n,
  15, case when n=2 then 0 else 5 end,
  '97000000-0000-0000-0000-000000000002', true, n=2
from generate_series(1, 1051) n;

insert into public.product_variants(product_id, color, size, price, stock_quantity, is_active) values
('98000000-0000-0000-0000-000000000002', 'Mavi', 'M', 120, 10, true),
('98000000-0000-0000-0000-000000000002', 'Kırmızı', 'L', 10, 0, true),
('98000000-0000-0000-0000-000000000002', 'Yeşil', 'M', 1, 999, false);

select pg_temp.assert_true(
  not has_function_privilege('anon',
    'public.catalog_search_page(text,text,text,numeric,numeric,text,text,boolean,boolean,integer,integer)',
    'execute'),
  'catalog page RPC remains service-only');
select pg_temp.assert_true(
  not has_function_privilege('authenticated',
    'public.catalog_category_facets(text)', 'execute'),
  'category facets RPC remains service-only');

set local role service_role;

select pg_temp.assert_true(
  (select count(*) from public.catalog_search_page(p_q=>'CATPAGEFIXTURE') where product_id is not null)=24,
  'only first 24 products are returned');
select pg_temp.assert_true(
  (select total_count from public.catalog_search_page(p_q=>'CATPAGEFIXTURE') limit 1)=1051,
  'total reflects catalog beyond 1000 rows');
select pg_temp.assert_true(
  (select count(*) from public.catalog_search_page(p_category=>'catpage-root',
    p_q=>'CATPAGEFIXTURE') where product_id is not null)=24,
  'parent category includes descendants');
select pg_temp.assert_true(
  (select count(*) from public.catalog_search_page(p_q=>'CATPAGEFIXTURE',p_page=>44)
   where product_id is not null)=19,
  'last page contains the correct number of products');
select pg_temp.assert_true(
  (select product_id is null and total_count=1051
   from public.catalog_search_page(p_q=>'CATPAGEFIXTURE',p_page=>500)
   limit 1),
  'stale page still returns a total for clamping');
select pg_temp.assert_true(
  (select variant_id from public.catalog_search_page(p_q=>'CATPAGEFIXTURE',
   p_color=>'Mavi',p_stock=>true) where product_id is not null limit 1)
   = (select id from public.product_variants where product_id='98000000-0000-0000-0000-000000000002'
      and color='Mavi'),
  'variant filters return the matching available option');
select pg_temp.assert_true(
  (select total_count from public.catalog_search_page(p_q=>'CATPAGEFIXTURE',
    p_color=>'Kırmızı',p_stock=>true) limit 1)=0,
  'out-of-stock variant is excluded when stock filter is enabled');
select pg_temp.assert_true(
  (select total_count from public.catalog_search_page(p_q=>'CATPAGEFIXTURE',
    p_min=>15,p_max=>15) limit 1)=1050,
  'price filtering excludes a product with only higher in-stock variants');
select pg_temp.assert_true(
  (select 'Mavi'=any(colors) and 'Kırmızı'=any(colors) and not ('Yeşil'=any(colors))
   from public.catalog_category_facets('catpage-root')),
  'facets contain active variants across child categories');
select pg_temp.expect_error(
  $q$select * from public.catalog_search_page(p_page_size=>100)$q$, '22023',
  'unbounded catalog pages are rejected');

do $$
declare
  seen uuid[] := '{}'; n integer;
begin
  for n in 1..44 loop
    select seen || coalesce(array_agg(product_id), '{}'::uuid[])
      into seen
    from public.catalog_search_page(p_q=>'CATPAGEFIXTURE',p_page=>n)
    where product_id is not null;
  end loop;
  perform pg_temp.assert_true(
    cardinality(seen)=1051
    and (select count(distinct x) from unnest(seen) x)=1051,
    'every product occurs exactly once across all pages');
end;
$$;

rollback;
