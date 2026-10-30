begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;

insert into auth.users(id,email,email_confirmed_at) values
 ('da000000-0000-0000-0000-000000000001','email-test@example.invalid',now()),
 ('da000000-0000-0000-0000-000000000002','unconfirmed@example.invalid',null);
create function pg_temp.make_order(p_id uuid,p_user uuid,p_payment text default 'not_collected') returns void language sql as $$
 insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,customer_user_id,payment_status)
 values(p_id,'EMAIL-'||p_id::text,'Test customer','05555555555','Istanbul','Bagcilar','Test address 123',100,100,p_user,p_payment);
$$;
select pg_temp.assert_true(not has_table_privilege('authenticated','private.order_email_outbox','select'),'outbox not readable by customers');
select pg_temp.assert_true(not has_function_privilege('anon','public.claim_order_emails()','execute'),'anonymous cannot claim');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.finish_order_email(uuid,uuid,text,text,boolean)','execute'),'customers cannot acknowledge');
select pg_temp.make_order('db000000-0000-0000-0000-000000000001','da000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select count(*)=0 from private.order_email_outbox),'disabled settings create no historical backlog');
update private.order_email_settings set enabled=true,enabled_at=now();
select pg_temp.make_order('db000000-0000-0000-0000-000000000002','da000000-0000-0000-0000-000000000001');
select pg_temp.make_order('db000000-0000-0000-0000-000000000003','da000000-0000-0000-0000-000000000002');
select pg_temp.make_order('db000000-0000-0000-0000-000000000004',null);
select pg_temp.make_order('db000000-0000-0000-0000-000000000005','da000000-0000-0000-0000-000000000001','pending');
select pg_temp.assert_true((select count(*)=1 from private.order_email_outbox),'only confirmed account gets receipt; pending payment and guests skipped');
update public.order_requests set status='shipped',carrier='Yurtiçi',tracking_number='TRACK-123'
 where id='db000000-0000-0000-0000-000000000002';
update public.order_requests set status='shipped' where id='db000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select count(*)=2 from private.order_email_outbox),'shipped transition queues one message');
select pg_temp.assert_true((select message->>'text' like '%TRACK-123%' from private.order_email_outbox where event_type='order_shipped'),'tracking snapshot included');

set local role service_role;
create temp table email_claims as select * from public.claim_order_emails();
select pg_temp.assert_true((select count(*)=2 from email_claims),'service claims batch');
select pg_temp.assert_true((select count(*)=0 from public.claim_order_emails()),'second worker cannot claim leased jobs');
select pg_temp.assert_true(not public.finish_order_email((select id from email_claims limit 1),gen_random_uuid(),'provider-id'),'stale worker cannot acknowledge');
select pg_temp.assert_true(public.finish_order_email((select id from email_claims limit 1),(select lease_token from email_claims limit 1),'provider-id'),'accepted message acknowledged');
reset role;
update private.order_email_outbox set lease_until=now()-interval '1 minute' where state='processing';
set local role service_role;
create temp table retry_claim as select * from public.claim_order_emails();
select pg_temp.assert_true((select count(*)=1 from retry_claim),'expired lease recovered without claiming sent message');
select pg_temp.assert_true(public.finish_order_email((select id from retry_claim),(select lease_token from retry_claim),null,'provider_429',true),'transient rejection rescheduled');
reset role;
select pg_temp.assert_true((select attempts=2 and state='pending' and available_at>now() from private.order_email_outbox where state='pending'),'backoff and attempt count persisted');
update private.order_email_outbox set first_attempt_at=now()-interval '24 hours',available_at=now()-interval '1 minute' where state='pending';
set local role service_role;
select pg_temp.assert_true((select count(*)=0 from public.claim_order_emails()),'old ambiguous attempts never replay after idempotency retention');
reset role;
select pg_temp.assert_true((select count(*)=1 from private.order_email_outbox where last_error='retry_window_expired'),'expired retry requires review');
rollback;
