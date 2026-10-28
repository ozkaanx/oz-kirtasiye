begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then if sqlstate=code then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL: %',label;end;$$;
insert into auth.users(id,email) values ('91000000-0000-0000-0000-000000000001','review-admin@example.invalid'),('91000000-0000-0000-0000-000000000002','review-customer@example.invalid');
insert into public.store_admins(user_id,role) values('91000000-0000-0000-0000-000000000001','owner');
insert into public.products(id,name,slug,price,is_active)
select ('92000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'REVFIXTURE Product '||n,'revfixture-product-'||n,10,n%2=0 from generate_series(1,1005)n;
insert into public.product_reviews(id,product_id,user_id,rating,body,status,created_at)
select ('93000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('92000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '91000000-0000-0000-0000-000000000002',case when n%3=2 then 4 else 2 end,
 case when n=1 then 'REVFIXTURE İPEK IŞIK %_' when n=1005 then 'REVFIXTURE UNIQUE-LAST-1005' else 'REVFIXTURE Customer experience '||n end,
 case n%3 when 1 then 'pending' when 2 then 'approved' else 'rejected' end,case when n=1005 then '2000-01-01T12:00:00Z'::timestamptz else '2026-01-01T12:00:00.123456Z'::timestamptz end from generate_series(1,1005)n;
select pg_temp.assert_true(not has_function_privilege('anon','public.admin_search_reviews(text,text,integer)','execute'),'anonymous cannot execute admin review search');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.admin_search_reviews()$q$,'42501','review owner cannot call admin search');
select pg_temp.expect_error($q$select public.moderate_product_review('93000000-0000-0000-0000-000000000001','approved')$q$,'42501','review owner cannot moderate reviews');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.admin_search_reviews(text,text,integer)'::regprocedure),'review search uses invoker rights');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','all')->>'total')::int=1005,'review search covers beyond first 1000 rows');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_reviews('REVFIXTURE','all')->'rows')=25,'review pages are bounded to 25');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','pending')->>'total')::int=335,'pending filter is server-side');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','approved')->>'total')::int=335,'approved filter is server-side');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','rejected')->>'total')::int=335,'rejected filter is server-side');
select pg_temp.assert_true((public.admin_search_reviews('ipek ışık','all')->>'total')::int=1,'review search normalizes Turkish I');
select pg_temp.assert_true((public.admin_search_reviews('%_','all')->>'total')::int=1,'review wildcard input is literal');
select pg_temp.assert_true((public.admin_search_reviews('UNIQUE-LAST-1005','all')->>'total')::int=1,'older review beyond first thousand is searchable by body');
select pg_temp.assert_true((public.admin_search_reviews('Product 1005','all')->>'total')::int=1,'product name search includes inactive products');
select pg_temp.assert_true((public.admin_search_reviews('NO_REVIEW_MATCH','all')->>'total')::int=0,'empty search returns exact zero');
select pg_temp.assert_true((public.admin_search_reviews('NO_REVIEW_MATCH','all')->'stats'->>'all')::int>=1005,'global review counts survive filters');
select pg_temp.assert_true((public.admin_search_reviews('NO_REVIEW_MATCH','all')->'stats'->>'average')::numeric=(select avg(rating) from public.product_reviews where status='approved'),'approved average covers entire database');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','all',1000000)->>'page')::int=41,'stale review page clamps to actual last page');
select pg_temp.expect_error($q$select public.admin_search_reviews(p_status=>'invented')$q$,'22023','invalid review status is rejected');
select pg_temp.expect_error($q$select public.admin_search_reviews(p_page=>0)$q$,'22023','invalid review page is rejected');
do $$declare r jsonb;seen uuid[]:='{}';n integer;begin
 for n in 1..41 loop
  r:=public.admin_search_reviews('REVFIXTURE','all',n);
  select seen||coalesce(array_agg((e->>'id')::uuid),'{}') into seen from jsonb_array_elements(r->'rows')e;
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=1005 and (select count(distinct x) from unnest(seen)x)=1005,'equal timestamp review pages do not duplicate or skip records');
 perform pg_temp.assert_true((r->>'hasNext')::boolean=false and (r->>'hasPrevious')::boolean=true,'last review page navigation is correct');
end;$$;
select public.moderate_product_review('93000000-0000-0000-0000-000000000001','approved');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','pending')->>'total')::int=334,'moderation removes row from pending search and refreshes count');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','approved')->>'total')::int=336,'moderation updates approved search count');
select public.moderate_product_review('93000000-0000-0000-0000-000000000001','rejected');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','rejected')->>'total')::int=336,'rejection updates rejected count');
select pg_temp.assert_true((public.admin_search_reviews('REVFIXTURE','all')->'rows'->0 ? 'user_id')=false,'review response excludes customer identity');
rollback;
