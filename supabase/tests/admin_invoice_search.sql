begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlstate=code then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL: %',label;end;$$;
insert into auth.users(id,email) values ('a1000000-0000-0000-0000-000000000001','invoice-admin@example.invalid'),('a1000000-0000-0000-0000-000000000002','invoice-customer@example.invalid');
insert into public.store_admins(user_id,role) values('a1000000-0000-0000-0000-000000000001','owner');
insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,status,created_at,customer_user_id)
select ('a2000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'INVFIXTURE-'||n,case when n=1 then 'İPEK IŞIK %_' else 'Invoice Customer' end,'05551234567','İstanbul','Bağcılar','Test invoice address',100,100,'contacted',case when n=205 then '2000-01-01T00:00:00Z'::timestamptz else '2026-01-01T12:00:00.123456Z'::timestamptz end,'a1000000-0000-0000-0000-000000000002'::uuid from generate_series(1,205)n;
insert into public.order_billing_details(order_request_id,buyer_type,recipient_name,company_name,tax_office,tax_number,city,district,address)
select ('a2000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case when n=1 then 'corporate' else 'individual' end,'Invoice Recipient',case when n=1 then 'UNIQUE-COMPANY-FIXTURE' end,case when n=1 then 'Test office' end,case when n=1 then '1234567890' end,'İstanbul','Bağcılar','Test invoice address' from generate_series(1,205)n where n%3<>0;
insert into public.order_invoice_register(order_request_id,status,document_type,invoice_number,issue_date,recorded_at)
select ('a2000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case when n%3=2 then 'issued' else 'pending' end,case when n%3=2 then 'e_arsiv' end,case when n%3=2 then 'TST2026'||lpad(n::text,9,'0') end,case when n%3=2 then current_date end,case when n%3=2 then now() end from generate_series(1,205)n where n%3<>0;
insert into public.order_requests(reference,customer_name,phone,city,district,address,subtotal,total,created_at) values
 ('INVTZ-1','Invoice Date','05551234567','İstanbul','Bağcılar','Test invoice address',100,100,'2026-01-01T20:59:59.999999Z'),
 ('INVTZ-2','Invoice Date','05551234567','İstanbul','Bağcılar','Test invoice address',100,100,'2026-01-01T21:00:00Z'),
 ('INVTZ-3','Invoice Date','05551234567','İstanbul','Bağcılar','Test invoice address',100,100,'2026-01-02T20:59:59.999999Z'),
 ('INVTZ-4','Invoice Date','05551234567','İstanbul','Bağcılar','Test invoice address',100,100,'2026-01-02T21:00:00Z');
select pg_temp.assert_true(not has_function_privilege('anon','public.admin_search_invoices(text,text,date,date,integer)','execute'),'anonymous cannot execute invoice search');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.admin_search_invoices()$q$,'42501','order owner cannot call admin invoice search');
select pg_temp.expect_error($q$select public.admin_record_issued_invoice('a2000000-0000-0000-0000-000000000001','e_arsiv','REC2026000000001',current_date,'Test provider')$q$,'42501','customer cannot record issued invoice');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.admin_search_invoices(text,text,date,date,integer)'::regprocedure),'invoice search uses invoker rights');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE')->>'total')::int=205,'invoice search covers beyond last 200 orders');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_invoices('INVFIXTURE')->'rows')=25,'invoice page bounded to 25');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE-205')->>'total')::int=1,'old order from year 2000 is searchable');
select pg_temp.assert_true((public.admin_search_invoices('ipek ışık')->>'total')::int=1,'invoice search normalizes Turkish I');
select pg_temp.assert_true((public.admin_search_invoices('%_')->>'total')::int=1,'invoice wildcard input is literal');
select pg_temp.assert_true((public.admin_search_invoices('UNIQUE-COMPANY-FIXTURE')->>'total')::int=1,'company name is searchable');
select pg_temp.assert_true((public.admin_search_invoices('TST2026000000002')->>'total')::int=1,'official invoice number is searchable');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE','pending')->>'total')::int=69,'pending filter is exact');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE','issued')->>'total')::int=68,'issued filter is exact');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE','legacy')->>'total')::int=68,'legacy filter preserves orders without billing details');
select pg_temp.assert_true((public.admin_search_invoices('INVTZ','all','2026-01-02','2026-01-02')->>'total')::int=2,'date range uses inclusive Istanbul days');
select pg_temp.assert_true((public.admin_search_invoices('NO_INVOICE_MATCH')->>'total')::int=0,'no match returns exact zero');
select pg_temp.assert_true((public.admin_search_invoices('NO_INVOICE_MATCH')->'stats'->>'total')::int>=209,'global invoice summary survives filters');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE',p_page=>1000000)->>'page')::int=9,'stale invoice page clamps to last page');
select pg_temp.expect_error($q$select public.admin_search_invoices(p_status=>'bad')$q$,'22023','invalid invoice status rejected');
select pg_temp.expect_error($q$select public.admin_search_invoices(p_page=>0)$q$,'22023','invalid invoice page rejected');
select pg_temp.expect_error($q$select public.admin_search_invoices(p_from=>'2026-01-03',p_to=>'2026-01-01')$q$,'22023','reversed raw date range rejected');
do $$declare r jsonb;seen uuid[]:='{}';n integer;begin
 for n in 1..9 loop
  r:=public.admin_search_invoices('INVFIXTURE',p_page=>n);
  select seen||coalesce(array_agg((e->>'id')::uuid),'{}') into seen from jsonb_array_elements(r->'rows')e;
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=205 and (select count(distinct x) from unnest(seen)x)=205,'equal-time invoice pages do not repeat or skip orders');
 perform pg_temp.assert_true((r->>'hasNext')::boolean=false and (r->>'hasPrevious')::boolean=true,'last invoice navigation is correct');
end;$$;
select public.admin_record_issued_invoice('a2000000-0000-0000-0000-000000000001','e_arsiv','REC2026000000001',current_date,'Test provider');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE','pending')->>'total')::int=68,'invoice recording refreshes pending count');
select pg_temp.assert_true((public.admin_search_invoices('INVFIXTURE','issued')->>'total')::int=69,'invoice recording refreshes issued count');
select pg_temp.assert_true((public.admin_search_invoices('REC2026000000001')->'rows'->0->'billing'->>'company_name')='UNIQUE-COMPANY-FIXTURE','page includes authorized invoice recipient details');
select pg_temp.expect_error($q$select public.admin_record_issued_invoice('a2000000-0000-0000-0000-000000000001','e_arsiv','REC2026000000001',current_date,'Test provider')$q$,'22023','issued document cannot be recorded twice');
rollback;
