-- Aşama 29.1: isolated database regression for payment reservations.
begin;

create function pg_temp.assert_true(ok boolean,label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end;
$$;
create function pg_temp.expect_error(statement text,code text,label text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=code then raise notice 'PASS: %',label; return; end if;
    raise;
  end;
  raise exception 'FAIL: % (expected %)',label,code;
end;
$$;

insert into auth.users(id,email) values
('91000000-0000-0000-0000-000000000001','payment-admin@example.invalid');
insert into public.store_admins(user_id,role)
  values('91000000-0000-0000-0000-000000000001','owner');
insert into public.products(id,slug,name,price,stock_quantity,is_active) values
('92000000-0000-0000-0000-000000000001','payment-test-pencil','Payment pencil',100,5,true),
('92000000-0000-0000-0000-000000000002','payment-test-toy','Payment toy',80,0,true);
insert into public.product_variants(id,product_id,color,size,price,stock_quantity,is_active) values
('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002','Mavi','M',80,4,true);

update public.store_settings set pickup_enabled=true where id=1;
update public.automatic_campaigns set is_active=false;
insert into public.coupons(id,code,label,discount_type,discount_value)
  values('94000000-0000-0000-0000-000000000001','PAYTEST','Payment coupon','fixed',20);
insert into public.order_requests
  (id,reference,customer_name,phone,city,district,address,subtotal,discount_amount,coupon_code,total)
values
('95000000-0000-0000-0000-000000000001','PAY-TEST-1','Payment buyer','05551110001','Istanbul','Bagcilar','Test address 123',280,20,'PAYTEST',260),
('95000000-0000-0000-0000-000000000002','PAY-TEST-2','Payment buyer','05551110002','Istanbul','Bagcilar','Test address 123',400,0,null,400),
('95000000-0000-0000-0000-000000000003','PAY-TEST-3','Payment buyer','05551110003','Istanbul','Bagcilar','Test address 123',240,0,null,240),
('95000000-0000-0000-0000-000000000004','PAY-TEST-4','Payment buyer','05551110004','Istanbul','Bagcilar','Test address 123',100,0,null,100);
insert into public.order_request_items
  (order_request_id,product_id,variant_id,product_name,unit_price,quantity,line_total)
values
('95000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',null,'Payment pencil',100,2,200),
('95000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','Payment toy',80,1,80),
('95000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001',null,'Payment pencil',100,4,400),
('95000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','Payment toy',80,3,240),
('95000000-0000-0000-0000-000000000004','92000000-0000-0000-0000-000000000001',null,'Payment pencil',100,1,100);
insert into public.coupon_redemptions(coupon_id,order_request_id,discount_amount)
values('94000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001',20);

select pg_temp.assert_true(
 not has_function_privilege('anon','public.begin_payment_reservation(uuid,text,integer)','execute')
 and not has_function_privilege('authenticated','public.begin_payment_reservation(uuid,text,integer)','execute')
 and not has_function_privilege('authenticated','public.finish_payment_reservation(text,text,text)','execute')
 and not has_function_privilege('authenticated','public.expire_payment_reservations(integer)','execute'),
 'only service role may start, finish or expire payment reservations');
select pg_temp.assert_true(
 not has_table_privilege('authenticated','private.payment_attempts','select')
 and not has_table_privilege('anon','private.payment_reserved_items','select')
 and not has_schema_privilege('authenticated','private','usage'),
 'private payment ledgers remain hidden from browsers');
select pg_temp.assert_true(
 (select relrowsecurity from pg_class where oid='private.payment_attempts'::regclass)
 and (select relrowsecurity from pg_class where oid='private.payment_reserved_items'::regclass),
 'both private payment tables enable RLS');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims',
 '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000001"}',true);
select pg_temp.expect_error($q$update public.order_requests set payment_status='paid'
 where id='95000000-0000-0000-0000-000000000001'$q$,'42501',
 'admin cannot forge paid status through generic row update');
select pg_temp.expect_error($q$select * from public.begin_payment_reservation(
 '95000000-0000-0000-0000-000000000001','OZP-PAYTEST-1',900)$q$,'42501',
 'admin cannot start payment reservation');
reset role;

set local role service_role;
select pg_catalog.set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true(
 (select amount_kurus=26000 and payment_state='pending'
  from public.begin_payment_reservation(
   '95000000-0000-0000-0000-000000000001','OZP-PAYTEST-1',900)),
 'payment uses immutable database total, not a browser amount');
select pg_temp.assert_true(
 (select status='awaiting_payment' and payment_status='pending'
    and inventory_deducted_at is not null from public.order_requests
    where id='95000000-0000-0000-0000-000000000001')
 and (select stock_quantity=3 from public.products where id='92000000-0000-0000-0000-000000000001')
 and (select stock_quantity=3 from public.product_variants where id='93000000-0000-0000-0000-000000000001'),
 'reservation atomically deducts standard and variant quantities');
select pg_temp.assert_true(
 (select count(*)=2 from private.payment_reserved_items ri
  join private.payment_attempts pa on pa.id=ri.payment_id
  where pa.merchant_oid='OZP-PAYTEST-1'),
 'reserved quantities have a durable item ledger');
select pg_temp.assert_true(
 (select payment_state='pending' from public.begin_payment_reservation(
   '95000000-0000-0000-0000-000000000001','OZP-PAYTEST-1',900))
 and (select stock_quantity=3 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'duplicate reservation request does not consume stock twice');
select pg_temp.expect_error($q$select * from public.begin_payment_reservation(
 '95000000-0000-0000-0000-000000000001','OZP-PAYTEST-DIFFERENT',900)$q$,
 '22023','second merchant reference cannot reserve same order');
select pg_temp.expect_error($q$select * from public.begin_payment_reservation(
 '95000000-0000-0000-0000-000000000002','OZP-PAYTEST-2',900)$q$,
 '22023','overlapping orders cannot reserve more than available inventory');
select pg_temp.assert_true(
 (select count(*)=0 from private.payment_attempts where merchant_oid='OZP-PAYTEST-2')
 and (select stock_quantity=3 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'failed reservation rolls back the attempt and stock writes');

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims',
 '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000001"}',true);
select pg_temp.expect_error($q$update public.order_requests set status='contacted'
 where id='95000000-0000-0000-0000-000000000001'$q$,'42501',
 'admin cannot bypass active payment reservation with a direct status update');
select pg_temp.expect_error($q$select public.manage_order_request(
 '95000000-0000-0000-0000-000000000001','prepare')$q$,'22023',
 'legacy prepare cannot deduct reserved stock twice');
reset role;

set local role service_role;
select pg_temp.expect_error($q$select public.finish_payment_reservation(
 'OZP-PAYTEST-1',null)$q$,'22023',
 'missing/unverified provider outcome cannot be mistaken for success');
select pg_temp.assert_true(public.finish_payment_reservation('OZP-PAYTEST-1','failed')='failed',
 'failed payment releases reservation');
select pg_temp.assert_true(
 (select status='cancelled' and payment_status='failed'
    and inventory_restored_at is not null from public.order_requests
    where id='95000000-0000-0000-0000-000000000001')
 and (select stock_quantity=5 from public.products where id='92000000-0000-0000-0000-000000000001')
 and (select stock_quantity=4 from public.product_variants where id='93000000-0000-0000-0000-000000000001'),
 'failed payment restores both stock types once');
select pg_temp.assert_true(public.finish_payment_reservation('OZP-PAYTEST-1','failed')='failed'
 and (select stock_quantity=5 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'duplicate failure callback cannot restore stock twice');
select pg_temp.assert_true(
 (select count(*)=0 from public.coupon_redemptions r
  join public.order_requests o on o.id=r.order_request_id
  where r.coupon_id='94000000-0000-0000-0000-000000000001'
    and o.status<>'cancelled'),
 'failed payment no longer consumes coupon usage quota');
select pg_temp.assert_true(
 (select discount_amount=20 from public.quote_order_savings(
    '[{"productId":"92000000-0000-0000-0000-000000000001","quantity":2},
      {"productId":"92000000-0000-0000-0000-000000000002",
       "variantId":"93000000-0000-0000-0000-000000000001","quantity":1}]',
    'pickup','PAYTEST','05551110001',null)),
 'released coupon becomes usable again for the same customer');

select pg_temp.assert_true(
 (select amount_kurus=40000 from public.begin_payment_reservation(
  '95000000-0000-0000-0000-000000000002','OZP-PAYTEST-2',900)),
 'stock freed by failure can be used by another order');
select pg_temp.assert_true(public.finish_payment_reservation(
 'OZP-PAYTEST-2','succeeded','verified-provider-id')='succeeded',
 'successful payment commits stock hold');
select pg_temp.assert_true(
 (select status='paid' and payment_status='paid'
    and inventory_restored_at is null from public.order_requests
    where id='95000000-0000-0000-0000-000000000002')
 and (select stock_quantity=1 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'paid order stays deducted exactly once');
select pg_temp.assert_true(public.finish_payment_reservation('OZP-PAYTEST-2','succeeded')='succeeded'
 and public.finish_payment_reservation('OZP-PAYTEST-2','failed')='succeeded'
 and (select stock_quantity=1 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'duplicate/out-of-order payment callbacks cannot change accepted success');
select pg_temp.expect_error($q$select * from public.begin_payment_reservation(
 '95000000-0000-0000-0000-000000000002','OZP-PAYTEST-2',900)$q$,
 '22023','paid order cannot begin a second attempt');

-- A separate expired variant order must free inventory, but a late verified
-- success needs manual reconciliation: the stock must stay released.
select pg_temp.assert_true(
 (select amount_kurus=24000 from public.begin_payment_reservation(
  '95000000-0000-0000-0000-000000000003','OZP-PAYTEST-3',900)),
 'variant-only order can reserve inventory');
update private.payment_attempts set
  reserved_at=now()-interval '1 hour',expires_at=now()-interval '1 minute'
  where merchant_oid='OZP-PAYTEST-3';
select pg_temp.assert_true(public.expire_payment_reservations(10)=1,
 'expiry cleanup releases past-due payment');
select pg_temp.assert_true(
 public.expire_payment_reservations(10)=0
 and (select stock_quantity=4 from public.product_variants where id='93000000-0000-0000-0000-000000000001'),
 'repeating expiry job cannot double-restore inventory');
select pg_temp.assert_true(
 public.finish_payment_reservation('OZP-PAYTEST-3','succeeded')='requires_review',
 'late success is reported for reconciliation');
select pg_temp.assert_true(
 (select status='cancelled' and payment_status='requires_review'
   from public.order_requests where id='95000000-0000-0000-0000-000000000003')
 and (select stock_quantity=4 from public.product_variants where id='93000000-0000-0000-0000-000000000001'),
 'late success flags reconciliation instead of overselling released stock');
select pg_temp.assert_true(
 public.finish_payment_reservation('OZP-PAYTEST-3','succeeded')='requires_review',
 'replayed late success remains under review');

-- Manual workflows remain unchanged on legacy, unpaid orders.
reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims',
 '{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(
 public.manage_order_request('95000000-0000-0000-0000-000000000004','contact')='contacted',
 'legacy contact action still works');
select pg_temp.assert_true(
 public.manage_order_request('95000000-0000-0000-0000-000000000004','prepare')='processing',
 'legacy prepare still enters processing state');
select pg_temp.assert_true(
 (select stock_quantity=0 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'legacy prepare still deducts only its own inventory');
select pg_temp.assert_true(
 public.manage_order_request('95000000-0000-0000-0000-000000000004','cancel',null,null,'Test iptali')='cancelled',
 'legacy cancellation still enters cancelled state');
select pg_temp.assert_true(
 (select stock_quantity=1 from public.products where id='92000000-0000-0000-0000-000000000001'),
 'legacy cancellation still restores its own stock');

reset role;
rollback;
