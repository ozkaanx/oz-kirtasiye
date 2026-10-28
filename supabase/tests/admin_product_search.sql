begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$ begin
 begin execute statement; exception when others then if sqlstate=code then raise notice 'PASS: %',label; return; end if; raise; end;
 raise exception 'FAIL: %',label; end; $$;
insert into auth.users(id,email) values ('81000000-0000-0000-0000-000000000001','product-admin@example.invalid'),('81000000-0000-0000-0000-000000000002','product-customer@example.invalid');
insert into public.store_admins(user_id,role) values('81000000-0000-0000-0000-000000000001','owner');
insert into public.categories(id,name,slug,parent_id) values ('82000000-0000-0000-0000-000000000001','Parent','pgpage-parent',null),('82000000-0000-0000-0000-000000000002','Child','pgpage-child','82000000-0000-0000-0000-000000000001');
insert into public.products(id,name,slug,sku,price,stock_quantity,low_stock_threshold,category_id,is_active,has_variants)
select ('83000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 case when n=1 then 'PGPAGEFIXTURE İPEK IŞIK %_' else 'PGPAGEFIXTURE Same name' end,'pgpagefixture-'||n,'PGSKUFIXTURE-'||n,
 case when n=2 then 1 else 15 end,5,2,'82000000-0000-0000-0000-000000000002',n%10<>0,n in (2,3) from generate_series(1,1005)n;
insert into public.product_variants(product_id,color,price,stock_quantity,is_active) values
 ('83000000-0000-0000-0000-000000000002','Active',100,10,true),
 ('83000000-0000-0000-0000-000000000002','Sold out',10,0,true),
 ('83000000-0000-0000-0000-000000000002','Inactive',1,999,false);
select pg_temp.assert_true(not has_function_privilege('anon','public.admin_search_products(text,uuid,text,text,text,integer)','execute'),'anon cannot execute product search');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.admin_search_products()$q$,'42501','customer cannot search admin products');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.admin_search_products(text,uuid,text,text,text,integer)'::regprocedure),'product search retains invoker RLS');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE')->>'total')::int=1005,'search covers beyond the first 1000 products');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_products('PGPAGEFIXTURE')->'rows')=25,'product response is bounded to 25 rows');
select pg_temp.assert_true((public.admin_search_products('ipek ışık')->>'total')::int=1,'product search handles Turkish I');
select pg_temp.assert_true((public.admin_search_products('%_')->>'total')::int=1,'product wildcard text is literal');
select pg_temp.assert_true((public.admin_search_products('PGSKUFIXTURE-1005')->>'total')::int=1,'SKU finds a product beyond first thousand');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE','82000000-0000-0000-0000-000000000001')->>'total')::int=1005,'category filtering includes descendants');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE',p_visibility=>'inactive')->>'total')::int=100,'inactive filter runs on whole catalog');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE',p_stock=>'out')->>'total')::int=1,'variant product without active options has zero stock');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE',p_sort=>'priceDesc')->'rows'->0->>'price')::numeric=100,'price sorting uses in-stock active variant price');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE',p_sort=>'stockDesc')->'rows'->0->>'stock_quantity')::int=10,'stock sorting excludes inactive variants');
select pg_temp.assert_true((public.admin_search_products('NO MATCH')->'stats'->>'total')::int>=1005,'global product summary survives no-match filter');
select pg_temp.assert_true((public.admin_search_products('NO MATCH')->>'total')::int=0,'no match returns exact zero');
select pg_temp.assert_true((public.admin_search_products('PGPAGEFIXTURE',p_page=>1000000)->>'page')::int=41,'stale page clamps to actual last page');
select pg_temp.expect_error($q$select public.admin_search_products(p_page=>0)$q$,'22023','invalid page is rejected by database');
select pg_temp.expect_error($q$select public.admin_search_products(p_sort=>'SQL')$q$,'22023','invalid sort is rejected by database');
do $$declare r jsonb; seen uuid[]:='{}'; n integer; begin
 for n in 1..41 loop
  r:=public.admin_search_products('PGPAGEFIXTURE',p_page=>n);
  select seen||coalesce(array_agg((e->>'id')::uuid),'{}') into seen from jsonb_array_elements(r->'rows')e;
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=1005 and (select count(distinct x) from unnest(seen)x)=1005,'equal-name rows have deterministic non-overlapping pages');
 perform pg_temp.assert_true((r->>'hasNext')::boolean=false and (r->>'hasPrevious')::boolean=true,'last page navigation flags are correct');
end;$$;
rollback;
