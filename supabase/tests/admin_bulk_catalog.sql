-- Stage 32 regression: admin-only cost storage and all-or-nothing SKU import.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
create function pg_temp.expect_error(stmt text, code text, label text) returns void
language plpgsql as $$ begin
 begin execute stmt;
 exception when others then
   if sqlstate=code then raise notice 'PASS: %',label; return; end if;
   raise exception 'FAIL: %, got % instead of %',label,sqlstate,code;
 end;
 raise exception 'FAIL: % (no error)',label;
end $$;

insert into auth.users(id,email) values
 ('b1000000-0000-0000-0000-000000000001','bulk-owner@example.invalid'),
 ('b1000000-0000-0000-0000-000000000002','bulk-customer@example.invalid');
insert into public.store_admins(user_id,role)
 values ('b1000000-0000-0000-0000-000000000001','owner');

insert into public.categories(id,name,slug) values
 ('b2000000-0000-0000-0000-000000000001','Defter','bulk-defter');
insert into public.products(id,name,slug,sku,price,stock_quantity,is_active) values
 ('b3000000-0000-0000-0000-000000000001','Eski defter','old-bulk-defter','BULK-001',10,9,true);

select pg_temp.assert_true(
 not has_table_privilege('anon','public.product_costs','select')
 and not has_function_privilege('anon','public.admin_bulk_import_products(jsonb,boolean,boolean)','execute'),
 'anonymous roles cannot read costs or import products');
select pg_temp.assert_true(
 not (select prosecdef from pg_proc
 where oid='public.admin_bulk_import_products(jsonb,boolean,boolean)'::regprocedure),
 'import runs with invoker role and RLS');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims',
 '{"role":"authenticated","sub":"b1000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_true((select count(*)=0 from public.product_costs),
 'customers cannot read purchase costs');
select pg_temp.expect_error($q$
 select public.admin_bulk_import_products('[{"sku":"BULK-900","slug":"bulk-900","name":"Denied","price":10}]'::jsonb,true)
$q$,'42501','customers cannot start a bulk import');

select pg_catalog.set_config('request.jwt.claims',
 '{"role":"authenticated","sub":"b1000000-0000-0000-0000-000000000001"}',true);

select pg_temp.assert_true(
 (public.admin_bulk_import_products('[
   {"sku":"BULK-001","slug":"ignored-on-update","price":22.5,"cost_price":12.25},
   {"sku":"BULK-002","slug":"new-bulk-defter","name":"Yeni defter","price":30,"cost_price":17,"category_slug":"bulk-defter","stock_quantity":4}
 ]'::jsonb,false)->>'created')::int=1,
 'preview correctly distinguishes 1 new and 1 existing product');
select pg_temp.assert_true(
 (select count(*)=0 from public.product_costs)
 and (select price=10 from public.products where sku='BULK-001')
 and (select count(*)=0 from public.products where sku='BULK-002'),
 'preview does not write any products or cost records');

select pg_temp.assert_true(
 (public.admin_bulk_import_products('[
  {"sku":"BULK-001","slug":"ignored-on-update","price":22.5,"cost_price":12.25,"stock_quantity":6},
  {"sku":"BULK-002","slug":"new-bulk-defter","name":"Yeni defter","price":30,"cost_price":17,"category_slug":"bulk-defter","stock_quantity":4}
 ]'::jsonb,true,true)->>'updated')::int=1,
 'confirmed update can explicitly change current stock');
select pg_temp.assert_true(
 (select price=22.5 and stock_quantity=6 and slug='old-bulk-defter' from public.products where sku='BULK-001')
 and (select price=30 and stock_quantity=4 and is_active=false from public.products where sku='BULK-002'),
 'update preserves original SEO slug; new products start unpublished');
select pg_temp.assert_true(
 (select cost_price=12.25 from public.product_costs where product_id='b3000000-0000-0000-0000-000000000001')
 and (select cost_price=17 from public.product_costs c join public.products p on p.id=c.product_id where p.sku='BULK-002'),
 'costs saved separately from public products');
select pg_temp.assert_true(
 (select count(*)=1 from public.stock_movements
 where product_id='b3000000-0000-0000-0000-000000000001'
 and change_quantity=-3 and note like 'Toplu CSV/Excel%'),
 'confirmed stock update goes through original audit trigger');
select pg_temp.expect_error($q$
 select public.admin_bulk_import_products('[{"sku":"BULK-001","slug":"unused","stock_quantity":1}]'::jsonb,true,false)
$q$,'22023','existing stock requires explicit opt-in');
select pg_temp.expect_error($q$
 select public.admin_bulk_import_products('[{"sku":"BULK-003","slug":"bulk3","name":"Third","price":6},{"sku":"BULK-004","slug":"bulk4","price":7}]'::jsonb,true,true)
$q$,'22023','invalid batch fails atomically');
select pg_temp.assert_true((select count(*)=0 from public.products where sku='BULK-003'),
 'failed batch creates no partial products');
select pg_temp.expect_error($q$
 select public.admin_bulk_import_products('[{"sku":"BULK-005","slug":"bulk5","name":"Fifth","price":7},{"sku":"BULK-005","slug":"bulk6","name":"Sixth","price":7}]'::jsonb,true,true)
$q$,'22023','duplicate file SKU is rejected');
select pg_temp.expect_error($q$
 select public.admin_bulk_import_products('[{"sku":"BULK-007","slug":"bulk7","name":"Seventh","price":7,"is_featured":true}]'::jsonb,true)
$q$,'22023','unknown privileged fields are forbidden');

set local role anon;
select pg_temp.expect_error('select count(*) from public.product_costs','42501',
 'guest cannot read the protected purchase-cost table');
rollback;
