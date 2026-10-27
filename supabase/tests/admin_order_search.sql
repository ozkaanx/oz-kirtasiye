begin;
select set_config('request.jwt.claims','{}',true);
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$ begin
 begin execute statement; exception when others then if sqlstate=code then raise notice 'PASS: %',label; return; end if; raise; end;
 raise exception 'FAIL: %',label; end; $$;
insert into auth.users(id,email) values
 ('71000000-0000-0000-0000-000000000001','search-admin@example.invalid'),
 ('71000000-0000-0000-0000-000000000002','search-customer@example.invalid');
insert into public.store_admins(user_id,role) values('71000000-0000-0000-0000-000000000001','owner');
insert into public.order_requests(id,reference,customer_name,phone,city,district,address,subtotal,total,status,delivery_method,created_at,customer_user_id)
select ('72000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'PAGEFIXTURE-'||n,
 case when n=1 then 'PAGEFIXTURE İPEK IŞIK %_' else 'PAGEFIXTURE Test buyer' end,
 '05551234567','İstanbul','Bağcılar','Test address 123',100,100,
 case when n%2=0 then 'contacted' else 'new' end,
 case when n%2=0 then 'pickup' else 'shipping' end,'2026-01-02T12:00:00.123456Z',
 '71000000-0000-0000-0000-000000000002'::uuid from generate_series(1,125) n;
-- Istanbul January 2 is [January 1 21:00Z, January 2 21:00Z).
insert into public.order_requests(reference,customer_name,phone,city,district,address,subtotal,total,created_at) values
 ('TZFIXTURE-1','Date test','05551234567','İstanbul','Bağcılar','Test address 123',100,100,'2026-01-01T20:59:59.999999Z'),
 ('TZFIXTURE-2','Date test','05551234567','İstanbul','Bağcılar','Test address 123',100,100,'2026-01-01T21:00:00Z'),
 ('TZFIXTURE-3','Date test','05551234567','İstanbul','Bağcılar','Test address 123',100,100,'2026-01-02T20:59:59.999999Z'),
 ('TZFIXTURE-4','Date test','05551234567','İstanbul','Bağcılar','Test address 123',100,100,'2026-01-02T21:00:00Z');
insert into public.products(id,slug,name,price,stock_quantity,is_active) values('73000000-0000-0000-0000-000000000001','search-test-product','Search test product',100,10,true);
insert into public.order_request_items(order_request_id,product_id,product_name,unit_price,quantity,line_total)
 values('72000000-0000-0000-0000-000000000125','73000000-0000-0000-0000-000000000001','Search test product',100,1,100);
set local role anon;
select pg_temp.expect_error('select public.admin_search_orders()','42501','guest cannot search orders');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_true((select count(*)=125 from public.order_requests),'customer fixture ownership permits direct own-row read');
select pg_temp.expect_error('select public.admin_search_orders()','42501','customer cannot use admin search despite own orders');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.admin_search_orders(text,text,text,date,date,timestamptz,uuid,text,integer)'::regprocedure),'search uses invoker rights and retains RLS');
select pg_temp.assert_true((public.admin_search_orders('PAGEFIXTURE')->>'total')::int=125,'count includes more than last hundred');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_orders('PAGEFIXTURE')->'rows')=25,'only one bounded page returned');
select pg_temp.assert_true(public.admin_search_orders('PAGEFIXTURE')->'rows'->0->'order_request_items'->0->>'product_name'='Search test product','page includes only its nested line items');
select pg_temp.assert_true(jsonb_array_length(public.admin_search_orders('PAGEFIXTURE')->'rows'->0->'order_request_status_history')>=1,'page includes existing status history');
select pg_temp.assert_true((public.admin_search_orders('PAGEFIXTURE-1')->>'total')::int=37,'reference substring search finds old records');
select pg_temp.assert_true((public.admin_search_orders('ipek ışık')->>'total')::int=1,'Turkish dotted and dotless I search');
select pg_temp.assert_true((public.admin_search_orders('%_')->>'total')::int=1,'wildcards are literal search characters');
select pg_temp.assert_true((public.admin_search_orders('PAGEFIXTURE','new','shipping')->>'total')::int=63,'status and delivery filters combine');
select pg_temp.assert_true((public.admin_search_orders('PAGEFIXTURE','new','pickup')->>'total')::int=0,'no match returns a genuine zero');
select pg_temp.assert_true((public.admin_search_orders('TZFIXTURE',null,null,'2026-01-02','2026-01-02')->>'total')::int=2,'inclusive local-day bounds exclude next midnight');
select pg_temp.assert_true((public.admin_search_orders('DOES-NOT-EXIST')->'stats'->>'total')::int>=129,'global statistics do not shrink with filters');
select pg_temp.expect_error($q$select public.admin_search_orders(p_limit=>51)$q$,'22023','oversized page rejected');
select pg_temp.expect_error($q$select public.admin_search_orders(p_limit=>null)$q$,'22023','null page size rejected');
select pg_temp.expect_error($q$select public.admin_search_orders(p_status=>'invented')$q$,'22023','invalid status rejected');
select pg_temp.expect_error($q$select public.admin_search_orders(p_cursor_id=>'72000000-0000-0000-0000-000000000001')$q$,'22023','partial cursor rejected');
select pg_temp.expect_error($q$select public.admin_search_orders(p_from=>'2026-01-03',p_to=>'2026-01-02')$q$,'22023','reversed dates rejected');
do $$ declare r jsonb; r2 jsonb; seen uuid[]:='{}'; last_row jsonb; first_page jsonb; i integer:=0; begin
 r:=public.admin_search_orders('PAGEFIXTURE'); first_page:=r->'rows';
 perform pg_temp.assert_true((r->>'hasPrevious')::boolean=false and (r->>'hasNext')::boolean=true,'first page navigation flags');
 loop
  select seen||coalesce(array_agg((e->>'id')::uuid),'{}') into seen from jsonb_array_elements(r->'rows') e;
  i:=i+1; if not (r->>'hasNext')::boolean then exit; end if;
  if i>6 then raise exception 'pagination loop did not terminate'; end if;
  last_row:=r->'rows'->(jsonb_array_length(r->'rows')-1);
  r2:=public.admin_search_orders('PAGEFIXTURE',p_cursor_time=>(last_row->>'created_at')::timestamptz,p_cursor_id=>(last_row->>'id')::uuid);
  if i=1 then
   perform pg_temp.assert_true((r2->>'hasPrevious')::boolean,'second page has previous');
   perform pg_temp.assert_true((public.admin_search_orders('PAGEFIXTURE',p_cursor_time=>(r2->'rows'->0->>'created_at')::timestamptz,p_cursor_id=>(r2->'rows'->0->>'id')::uuid,p_direction=>'before')->'rows')=first_page,'previous page reverses keyset correctly');
  end if;
  r:=r2;
 end loop;
 perform pg_temp.assert_true(cardinality(seen)=125 and (select count(distinct x) from unnest(seen) x)=125,'all equal-timestamp records appear once across five pages');
 perform pg_temp.assert_true(i=5 and (r->>'hasNext')::boolean=false,'last page terminates navigation');
 perform pg_temp.assert_true((public.admin_search_orders('PAGEFIXTURE',p_cursor_time=>'1900-01-01',p_cursor_id=>'72000000-0000-0000-0000-000000000001')->'rows')='[]'::jsonb,'stale cursor returns safe empty page');
end; $$;
rollback;
