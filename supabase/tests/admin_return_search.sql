begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end;$$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if sqlstate=code then raise notice 'PASS: %',label;return;end if;raise;end;raise exception 'FAIL: %',label;end;$$;
insert into auth.users(id,email) values ('b1000000-0000-0000-0000-000000000001','return-admin@example.invalid'),('b1000000-0000-0000-0000-000000000002','return-customer@example.invalid');
insert into public.store_admins(user_id,role) values('b1000000-0000-0000-0000-000000000001','owner');
insert into public.products(id,name,slug,price,stock_quantity,is_active) values('b2000000-0000-0000-0000-000000000001','Return test product','return-test-product',10,10,true);
insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,status,inventory_deducted_at,customer_user_id)
select ('b3000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'RETFIXTURE-'||n,case when n=1 then 'İPEK IŞIK %_' else 'Return Customer' end,'05551234567','İstanbul','Bağcılar','Test return address',10,10,'delivered',now(),'b1000000-0000-0000-0000-000000000002'::uuid from generate_series(1,205)n;
insert into public.order_request_items(id,order_request_id,product_id,product_name,variant_label,unit_price,quantity,line_total)
select ('b4000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('b3000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'b2000000-0000-0000-0000-000000000001','Return test product',case when n=205 then 'UNIQUE-VARIANT-FIXTURE' else 'Blue' end,10,1,10 from generate_series(1,205)n;
insert into public.order_return_requests(id,order_request_id,order_item_id,customer_user_id,request_type,quantity,reason,customer_note,status,received_at,closed_at,created_at)
select ('b5000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('b3000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('b4000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'b1000000-0000-0000-0000-000000000002',case when n%2=0 then 'exchange' else 'return' end,1,'other','Return fixture customer note',case n%5 when 1 then 'requested' when 2 then 'approved' when 3 then 'rejected' when 4 then 'received' else 'closed' end,case when n%5 in (0,4) then now() end,case when n%5=0 then now() end,case when n=205 then '2000-01-01T00:00:00Z'::timestamptz else '2026-01-01T12:00:00.123456Z'::timestamptz end from generate_series(1,205)n;
insert into public.order_return_status_history(id,return_request_id,to_status,note,created_at)
select ('b6000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'b5000000-0000-0000-0000-000000000205','closed','History fixture','2026-01-01T12:00:00Z' from generate_series(1,1001)n;
insert into public.order_invoice_register(order_request_id,status,document_type,invoice_number,issue_date,recorded_at) values('b3000000-0000-0000-0000-000000000001','issued','e_arsiv','TRN2026000000001',current_date,now());
select pg_temp.assert_true(not has_function_privilege('anon','public.admin_search_returns(text,text,text,integer)','execute'),'anonymous cannot search admin returns');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_error($q$select public.admin_search_returns()$q$,'42501','return owner cannot search admin returns');
select pg_temp.expect_error($q$select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','approve')$q$,'42501','customer cannot approve returns');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.admin_search_returns(text,text,text,integer)'::regprocedure),'return search retains invoker RLS');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE')->>'total')::int=205,'return search covers beyond last 200');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_returns('RETFIXTURE')->'rows')=25,'return page bounded to 25');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE-205')->>'total')::int=1,'old return from year 2000 is searchable');
select pg_temp.assert_true((public.admin_search_returns('ipek ışık')->>'total')::int=1,'return search normalizes Turkish I');
select pg_temp.assert_true((public.admin_search_returns('%_')->>'total')::int=1,'return wildcard input is literal');
select pg_temp.assert_true((public.admin_search_returns('UNIQUE-VARIANT-FIXTURE')->>'total')::int=1,'variant name is searchable');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE','requested')->>'total')::int=41,'requested filter is exact');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE','received')->>'total')::int=41,'received filter is exact');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE',p_kind=>'exchange')->>'total')::int=102,'exchange filter is exact');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE','requested','return')->>'total')::int=21,'kind and status filters combine');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_returns('RETFIXTURE-205')->'rows'->0->'history')=1001,'page history is not truncated by old global 1000 limit');
select pg_temp.assert_true((public.admin_search_returns('NO_RETURN_MATCH')->>'total')::int=0,'no-match return filter is exact zero');
select pg_temp.assert_true((public.admin_search_returns('NO_RETURN_MATCH')->'stats'->>'total')::int>=205,'global return statistics survive filters');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE',p_page=>1000000)->>'page')::int=9,'stale return page clamps');
select pg_temp.expect_error($q$select public.admin_search_returns(p_status=>'bad')$q$,'22023','invalid return status rejected');
select pg_temp.expect_error($q$select public.admin_search_returns(p_kind=>'bad')$q$,'22023','invalid return kind rejected');
select pg_temp.expect_error($q$select public.admin_search_returns(p_page=>0)$q$,'22023','invalid return page rejected');
do $$declare r jsonb;seen uuid[]:='{}';n integer;begin
 for n in 1..9 loop
  r:=public.admin_search_returns('RETFIXTURE',p_page=>n);
  select seen||coalesce(array_agg((e->>'id')::uuid),'{}') into seen from jsonb_array_elements(r->'rows')e;
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=205 and (select count(distinct x) from unnest(seen)x)=205,'equal-time return pages do not repeat or skip requests');
 perform pg_temp.assert_true((r->>'hasNext')::boolean=false and (r->>'hasPrevious')::boolean=true,'last return navigation is correct');
end;$$;
select pg_temp.expect_error($q$select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','close','Physical check note',true,true,'resellable')$q$,'22023','cannot close before physical receipt');
select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','approve');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE','requested')->>'total')::int=40,'approval updates pending count');
select pg_temp.assert_true((select stock_quantity from public.products where id='b2000000-0000-0000-0000-000000000001')=10,'approval never restores stock');
select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','receive');
select pg_temp.assert_true((public.admin_search_returns('RETFIXTURE','received')->>'total')::int=42,'physical receipt updates received count');
select pg_temp.assert_true((select stock_quantity from public.products where id='b2000000-0000-0000-0000-000000000001')=10,'receipt alone never restores stock');
select pg_temp.expect_error($q$select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','close','Physical check note',true,false,'resellable')$q$,'22023','issued invoice requires accounting review');
select pg_temp.expect_error($q$select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','close','Physical check note',true,true,'damaged')$q$,'22023','damaged item cannot restore sellable stock');
select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','close','Physical check note',true,true,'resellable');
select pg_temp.assert_true((select stock_quantity from public.products where id='b2000000-0000-0000-0000-000000000001')=11,'verified resellable closure restores stock once');
select pg_temp.assert_true((public.admin_search_returns('ipek ışık')->'rows'->0->>'restocked_quantity')::int=1,'return response shows restored quantity');
select pg_temp.assert_true((public.admin_search_returns('ipek ışık')->'rows'->0->'order'->>'invoice_issued')::boolean,'return response preserves issued invoice flag');
select pg_temp.expect_error($q$select public.admin_handle_return_request('b5000000-0000-0000-0000-000000000001','close','Physical check note',true,true,'resellable')$q$,'22023','closed return cannot restore stock twice');
rollback;
