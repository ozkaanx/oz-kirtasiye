begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.expect_error(stmt text,code text,label text) returns void language plpgsql as $$begin begin execute stmt;exception when others then if sqlstate=code then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL: % (no error)',label;end;$$;
insert into auth.users(id,email) values
('da100000-0000-0000-0000-000000000001','audit-admin@example.invalid'),
('da100000-0000-0000-0000-000000000002','audit-buyer@example.invalid'),
('da100000-0000-0000-0000-000000000003','audit-other@example.invalid');
insert into public.store_admins(user_id,role) values('da100000-0000-0000-0000-000000000001','owner');
select pg_temp.assert_true(not has_function_privilege('anon','public.admin_save_product(uuid,jsonb,numeric)','execute')
 and not has_function_privilege('anon','public.customer_return_page(integer,integer)','execute'),'anon cannot call new private flows');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"da100000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.admin_save_product(gen_random_uuid(),'{}')$q$,'42501','customer cannot save products');
select pg_temp.expect_error($q$select public.admin_confirm_product_import('[]')$q$,'42501','customer cannot preview admin import');
select set_config('request.jwt.claims','{"sub":"da100000-0000-0000-0000-000000000001"}',true);
do $$declare payload jsonb:='{"name":"Audit pen","slug":"audit-pen","sku":" audit-pen ","price":20,"stock_quantity":7,"low_stock_threshold":3,"is_active":true,"is_featured":false}'::jsonb;
 rid uuid:='da300000-0000-0000-0000-000000000001';rows jsonb;preview jsonb;begin
 perform public.admin_save_product(rid,payload,10);
 perform pg_temp.assert_true((select sku='AUDIT-PEN' and stock_quantity=7 from public.products where id=rid),'single save normalizes SKU');
 update public.products set stock_quantity=5 where id=rid;
 perform public.admin_save_product(rid,payload,11);
 perform pg_temp.assert_true((select stock_quantity=5 from public.products where id=rid),'retry same UUID never resets stock');
 perform pg_temp.assert_true((select cost_price=11 from public.product_costs where product_id=rid),'product cost saved atomically');
 perform pg_temp.expect_error($q$select public.admin_save_product('da300000-0000-0000-0000-000000000002',
 '{"name":"Bad cost","slug":"audit-bad-cost","price":10,"stock_quantity":0,"low_stock_threshold":3,"is_active":false,"is_featured":false}',-1)$q$,'22023','invalid cost cannot partially create product');
 perform pg_temp.assert_true(not exists(select 1 from public.products where slug='audit-bad-cost'),'failed save leaves no product');
 perform pg_temp.expect_error($q$insert into public.products(name,slug,sku,price) values('Duplicate','audit-duplicate','audit-pen',20)$q$,'23505','case-insensitive SKU unique across every write path');
 rows:='[{"sku":"AUDIT-PEN","slug":"unused","price":25,"stock_quantity":4}]';
 preview:=public.admin_confirm_product_import(rows,false,true);
 perform pg_temp.assert_true((preview->'rows'->0->>'previous_stock')::int=5,'preview shows exact old stock');
 update public.products set stock_quantity=3 where id=rid;
 begin perform public.admin_confirm_product_import(rows,true,true,preview->'expected');raise exception 'FAIL: stale import accepted';
 exception when serialization_failure then null;end;
 perform pg_temp.assert_true((select stock_quantity=3 and price=20 from public.products where id=rid),'stale preview leaves current stock and price unchanged');
 preview:=public.admin_confirm_product_import(rows,false,true);
 perform public.admin_confirm_product_import(rows,true,true,preview->'expected');
 perform pg_temp.assert_true((select stock_quantity=4 and price=25 from public.products where id=rid),'fresh confirmation imports successfully');
 perform public.admin_save_product(rid,payload,null);
 perform pg_temp.assert_true(not exists(select 1 from public.product_costs where product_id=rid),'clear cost is part of atomic save');
end $$;
reset role;
insert into public.products(name,slug,sku,price,is_active)
select case when n=2101 then 'ZZZ audit last target' else 'Audit selector product '||n end,
 'audit-selector-'||n,'AUDIT-SELECTOR-'||n,10,true from generate_series(1,2101)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"da100000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true((public.admin_search_products('ZZZ audit last target',null,'active','all','name',1)->>'total')::int=1,
 'campaign server search reaches product beyond old 2000-option catalog cap');
reset role;
insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,status,customer_user_id,created_at)
select ('da400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'AUDIT-ORDER-'||n,'Test Buyer','05550000000','İstanbul','Merkez','Test fixture address',100,100,'completed','da100000-0000-0000-0000-000000000002','2026-01-01'::timestamptz
from generate_series(1,65)n;
insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,status,customer_user_id)
values('da400000-0000-0000-0000-000000000099','AUDIT-OTHER','Other','05550000000','İstanbul','Merkez','Test fixture address',100,100,'completed','da100000-0000-0000-0000-000000000003');
insert into public.order_request_items(id,order_request_id,product_id,product_name,quantity,unit_price,line_total)
select ('da500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('da400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'da300000-0000-0000-0000-000000000001','Audit pen',99,1,99 from generate_series(1,65)n;
insert into public.order_return_requests(id,order_request_id,order_item_id,customer_user_id,quantity,request_type,reason,customer_note,status,created_at)
select ('da600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'da400000-0000-0000-0000-000000000065','da500000-0000-0000-0000-000000000065','da100000-0000-0000-0000-000000000002',1,'return','changed_mind','Test return request','requested','2026-01-01'::timestamptz from generate_series(1,65)n;
insert into public.order_return_status_history(return_request_id,from_status,to_status,note,created_at)
select 'da600000-0000-0000-0000-000000000065',null,'requested','History fixture','2026-01-01'::timestamptz from generate_series(1,505)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"da100000-0000-0000-0000-000000000002"}',true);
do $$declare r jsonb;seen uuid[]:='{}';n integer;begin
 r:=public.customer_return_page();
 perform pg_temp.assert_true((r->'ordersMeta'->>'total')::int=65 and (r->'requestsMeta'->>'total')::int=65,'customer sees own complete counts only');
 perform pg_temp.assert_true((select count(*)=65 from public.order_requests where customer_user_id=(select auth.uid())),
 'account exact count includes every order and excludes another customer');
 perform pg_temp.assert_true((r->'orders'->0->'order_request_items'->0->>'claimed_quantity')::int=65,'claimed quantity includes requests on every page');
 perform pg_temp.assert_true(jsonb_array_length(r->'history')>=505,'history is complete beyond old 500 global cap');
 for n in 1..4 loop
  r:=public.customer_return_page(n,n);
  select seen||array_agg((value->>'id')::uuid) into seen from jsonb_array_elements(r->'orders');
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=65 and (select count(distinct x)=65 from unnest(seen)x),'all old orders reachable with stable ID tie-break');
 r:=public.customer_return_page(999999,999999);
 perform pg_temp.assert_true((r->'ordersMeta'->>'page')::int=4 and jsonb_array_length(r->'orders')=5,'customer pages clamp to last page');
end $$;
select set_config('request.jwt.claims','{"sub":"da100000-0000-0000-0000-000000000003"}',true);
select pg_temp.assert_true(jsonb_array_length(public.customer_return_page()->'requests')=0,'other customer cannot read requests or history');
select pg_temp.expect_error('select public.customer_return_page(0,1)','22023','invalid page rejected');
rollback;
