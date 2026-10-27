begin;
select set_config('request.jwt.claims','{}',true);
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then if sqlstate=code then raise notice 'PASS: %',label; return; end if; raise; end;
 raise exception 'FAIL: % (expected SQLSTATE %)',label,code;
end; $$;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','idempotent@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','other@example.invalid');
insert into public.products(id,slug,name,price,stock_quantity,is_active)
 values('20000000-0000-0000-0000-000000000001','idempotent-test','Test pencil',100,10,true);
update public.store_settings set pickup_enabled=true where id=1;
update public.automatic_campaigns set is_active=false;
insert into public.coupons(id,code,label,discount_type,discount_value)
 values('30000000-0000-0000-0000-000000000001','TEST_IDEMPOTENT','Test coupon','fixed',10);
create temp table test_payload(payload jsonb);
insert into test_payload values('{
 "customerName":"Test buyer","phone":"05553334444","city":"Istanbul","district":"Bagcilar","address":"Test address 123","note":"",
 "items":[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}],
 "preInformationRead":true,"privacyNoticeRead":true,"noticeVersion":"2026-10-24-v2","deliveryMethod":"pickup",
 "billing":{"buyerType":"individual","recipientName":"Test buyer","city":"Istanbul","district":"Bagcilar","address":"Test address 123"},
 "couponCode":"TEST_IDEMPOTENT"
}');
grant select on test_payload to service_role;

select pg_temp.assert_true(not has_function_privilege('authenticated','public.submit_order_request_idempotent(uuid,text,jsonb,uuid)','execute'),'browser cannot forge request identity/hash');
select pg_temp.assert_true(not has_function_privilege('anon','public.consume_order_request_limits(text,text)','execute'),'anonymous callers cannot manipulate rate counters');
select pg_temp.assert_true(not has_table_privilege('authenticated','private.order_request_submissions','select'),'submission ledger is private');

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true((select not replayed and total=90 from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000001',repeat('a',64),(select payload from test_payload),'10000000-0000-0000-0000-000000000001')),'first attempt creates discounted order');
select pg_temp.assert_true((select replayed and total=90 from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000001',repeat('a',64),(select payload from test_payload),'10000000-0000-0000-0000-000000000001')),'retry returns cached success');
select pg_temp.assert_true((select count(*)=1 from public.order_requests where phone='05553334444'),'retry creates no second order');
select pg_temp.assert_true((select count(*)=1 from public.coupon_redemptions where coupon_id='30000000-0000-0000-0000-000000000001'),'retry does not consume coupon twice');
select pg_temp.expect_error($q$select * from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000001',repeat('b',64),(select payload from test_payload),'10000000-0000-0000-0000-000000000001')$q$,'PT409','same key with changed payload conflicts');
select pg_temp.expect_error($q$select * from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000001',repeat('a',64),(select payload from test_payload),'10000000-0000-0000-0000-000000000002')$q$,'PT409','another customer cannot replay the key');
reset role;
update public.products set price=500,stock_quantity=0 where id='20000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.assert_true((select replayed and total=90 from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000001',repeat('a',64),(select payload from test_payload),'10000000-0000-0000-0000-000000000001')),'retry ignores later stock/price/coupon changes');
reset role;
update public.products set price=100,stock_quantity=10 where id='20000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.expect_error($q$select * from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000002',repeat('b',64),
 (select jsonb_set(payload,'{billing,buyerType}','"corporate"') from test_payload),null)$q$,'22023','invalid checkout rolls back');
select pg_temp.assert_true((select count(*)=0 from private.order_request_submissions where request_key='50000000-0000-0000-0000-000000000002'),'failed request does not poison its key');
select pg_temp.assert_true((select not replayed and total=100 from public.submit_order_request_idempotent(
 '50000000-0000-0000-0000-000000000002',repeat('b',64),
 (select payload||'{"couponCode":null}'::jsonb from test_payload),null)),'corrected request may reuse a rolled-back key');

do $$ declare i integer; r record; begin
 for i in 1..20 loop
  select * into r from public.consume_order_request_limits(repeat('a',64),null);
  if not r.allowed then raise exception 'FAIL: actor blocked too early'; end if;
 end loop;
 raise notice 'PASS: actor allows twenty attempts in its window';
end; $$;
select pg_temp.assert_true((select not allowed and retry_after between 1 and 60 from public.consume_order_request_limits(repeat('a',64),null)),'actor limit supplies retry delay');
reset role;
update private.order_request_rate_limits set window_started_at=now()-interval '2 minutes' where key='actor:'||repeat('a',64);
set local role service_role;
select pg_temp.assert_true((select allowed from public.consume_order_request_limits(repeat('a',64),null)),'expired actor window resets');
do $$ declare i integer; r record; begin
 for i in 1..40 loop
  select * into r from public.consume_order_request_limits(lpad(to_hex(i),64,'0'),repeat('b',64));
  if not r.allowed then raise exception 'FAIL: IP blocked too early'; end if;
 end loop;
 raise notice 'PASS: IP allows forty attempts across different actors';
end; $$;
select pg_temp.assert_true((select not allowed from public.consume_order_request_limits(repeat('c',64),repeat('b',64))),'rotating browser identity cannot evade IP limit');
reset role;
update private.order_request_rate_limits set hits=200 where key='global';
set local role service_role;
select pg_temp.assert_true((select not allowed from public.consume_order_request_limits(repeat('d',64),null)),'global limit bounds fresh actors without trusted IP');
reset role;
insert into private.order_request_rate_limits values('expired-test-key',now()-interval '2 hours',1);
set local role service_role;
select * from public.consume_order_request_limits(repeat('e',64),null);
select pg_temp.assert_true((select count(*)=0 from private.order_request_rate_limits where key='expired-test-key'),'expired rate keys are pruned even when throttled');
reset role;
rollback;
