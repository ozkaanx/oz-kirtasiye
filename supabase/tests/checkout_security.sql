-- Run only against an isolated test database. Every fixture rolls back.
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end; $$;
create function pg_temp.expect_error(statement text, code text, label text) returns void
language plpgsql as $$ begin
 begin
  execute statement;
 exception when others then
  if sqlstate=code then raise notice 'PASS: %',label; return; end if;
  raise;
 end;
 raise exception 'FAIL: % (expected SQLSTATE %)',label,code;
end; $$;

insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','buyer@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','other@example.invalid'),
 ('10000000-0000-0000-0000-000000000003','admin@example.invalid');
insert into public.store_admins(user_id,role) values('10000000-0000-0000-0000-000000000003','owner');
insert into public.products(id,slug,name,price,stock_quantity,is_active) values
 ('20000000-0000-0000-0000-000000000001','security-test-pencil','Test pencil',100,10,true),
 ('20000000-0000-0000-0000-000000000002','security-test-book','Test book',200,10,true),
 ('20000000-0000-0000-0000-000000000003','security-test-hidden','Hidden book',200,10,false);
update public.automatic_campaigns set is_active=false;
update public.store_settings set shipping_enabled=true,pickup_enabled=true,shipping_flat_fee=20,free_shipping_threshold=null where id=1;
insert into public.coupons(id,code,label,discount_type,discount_value,max_uses_per_customer) values
 ('30000000-0000-0000-0000-000000000001','TEST_PRIVATE','Private test coupon','fixed',10,1),
 ('30000000-0000-0000-0000-000000000002','TEST_PUBLIC','Public test coupon','fixed',5,1);
insert into public.coupon_private_assignments(coupon_id,user_id)
 values('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,status,customer_user_id)
 values('40000000-0000-0000-0000-000000000001','TEST-DELIVERED','Test buyer','05551112222','Istanbul','Bagcilar','Test address 123',100,100,'delivered','10000000-0000-0000-0000-000000000001');
insert into public.order_request_items(order_request_id,product_id,product_name,unit_price,quantity,line_total)
 values('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Test pencil',100,1,100);

-- All endpoints accepting trusted customer IDs must remain service-only.
select pg_temp.assert_true(not exists (
 select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and 'p_customer_user_id'=any(p.proargnames)
 and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))
),'customer identity RPCs are not callable by browsers');
select pg_temp.assert_true(not has_schema_privilege('authenticated','private','usage'),'private helpers are not exposed to customers');

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true(auth.uid() is null,'service client has no customer JWT');
select pg_temp.assert_true((select discount_amount=10 and total=110 from public.quote_order_savings(
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','TEST_PRIVATE',null,'10000000-0000-0000-0000-000000000001')),'assigned customer can quote private coupon');
select pg_temp.expect_error($q$select * from public.quote_order_savings(
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','TEST_PRIVATE',null,null)$q$,'22023','guest cannot quote private coupon');
select pg_temp.expect_error($q$select * from public.quote_order_savings(
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','TEST_PRIVATE',null,'10000000-0000-0000-0000-000000000002')$q$,'22023','other customer cannot quote private coupon');
select pg_temp.assert_true((select discount_amount=5 from public.quote_order_savings(
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','pickup','TEST_PUBLIC',null,null)),'guest public coupon still works');
select pg_temp.expect_error($q$select * from public.quote_order_savings(
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":11}]','shipping',null,null,null)$q$,'22023','insufficient stock rejected');

select * from public.submit_order_request_with_auto_discounts(
 'Test buyer','05553334444','Istanbul','Bagcilar','Test address 123','',
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1,"price":0}]',
 true,true,'2026-10-24-v2','shipping','10000000-0000-0000-0000-000000000001',
 '{"buyerType":"individual","recipientName":"Test buyer","city":"Istanbul","district":"Bagcilar","address":"Test address 123"}',
 'TEST_PRIVATE');
select pg_temp.assert_true((select subtotal=100 and discount_amount=10 and total=110 and customer_user_id='10000000-0000-0000-0000-000000000001'
 from public.order_requests where phone='05553334444'),'checkout uses database price and verified customer identity');
select pg_temp.assert_true((select stock_quantity=10 from public.products where id='20000000-0000-0000-0000-000000000001'),'manual request does not reserve stock');
select pg_temp.assert_true((select count(*)=1 from public.coupon_redemptions where coupon_id='30000000-0000-0000-0000-000000000001'),'coupon redemption recorded once');
select pg_temp.expect_error($q$select * from public.quote_order_savings(
 '[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','TEST_PRIVATE',null,'10000000-0000-0000-0000-000000000001')$q$,'22023','per-customer redemption limit enforced');
reset role;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.assert_true((select count(*)=2 from public.products where id in (
 '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003')),'guest can read active products but not drafts');
select pg_temp.assert_true(not has_table_privilege('anon','public.store_admins','select'),'admin table remains inaccessible to guests');
select pg_temp.expect_error($q$select public.submit_product_review('20000000-0000-0000-0000-000000000001',5,'A valid review body')$q$,'42501','guest cannot submit review');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001"}',true);
select pg_temp.expect_error($q$insert into public.product_reviews(product_id,user_id,rating,body)
 values('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',5,'A valid review body')$q$,'42501','direct review insert is denied even for a purchaser');
select pg_temp.expect_error($q$select public.submit_product_review('20000000-0000-0000-0000-000000000002',5,'A valid review body')$q$,'42501','purchasing one product does not authorize another');
select public.submit_product_review('20000000-0000-0000-0000-000000000001',5,'A valid review body');
select pg_temp.assert_true((select count(*)=1 from public.product_reviews where status='pending'),'purchased product review awaits moderation');
select pg_temp.expect_error($q$update public.product_reviews set status='approved'$q$,'42501','customer cannot self-approve review');
select pg_temp.expect_error($q$select public.moderate_product_review((select id from public.product_reviews limit 1),'approved')$q$,'42501','customer cannot call admin moderation');
select pg_temp.assert_true((select count(*)=1 from public.my_private_coupons()),'customer sees their assigned coupon');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_true((select count(*)=0 from public.product_reviews),'other customer cannot read pending review');
select pg_temp.assert_true((select count(*)=0 from public.my_private_coupons()),'other customer cannot discover private coupon');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000003"}',true);
select public.moderate_product_review((select id from public.product_reviews where product_id='20000000-0000-0000-0000-000000000001'),'approved');
select public.manage_order_request((select id from public.order_requests where phone='05553334444'),'contact');
select public.manage_order_request((select id from public.order_requests where phone='05553334444'),'prepare');
select pg_temp.assert_true((select stock_quantity=9 from public.products where id='20000000-0000-0000-0000-000000000001'),'preparing deducts stock once');
select pg_temp.expect_error($q$select public.manage_order_request((select id from public.order_requests where phone='05553334444'),'prepare')$q$,'22023','repeated preparation is denied');
select public.manage_order_request((select id from public.order_requests where phone='05553334444'),'cancel',null,null,'Test cancellation');
select pg_temp.assert_true((select stock_quantity=10 from public.products where id='20000000-0000-0000-0000-000000000001'),'cancellation restores stock');
select pg_temp.expect_error($q$select public.manage_order_request((select id from public.order_requests where phone='05553334444'),'cancel',null,null,'Test cancellation')$q$,'22023','repeated cancellation cannot restore stock twice');
reset role;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.assert_true((select count(*)=1 from public.product_reviews),'approved review is public');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001"}',true);
select public.submit_product_review('20000000-0000-0000-0000-000000000001',4,'An edited valid review body');
select pg_temp.assert_true((select count(*)=1 from public.product_reviews where status='pending' and rating=4),'editing review resets moderation without duplicating it');
reset role;
rollback;
