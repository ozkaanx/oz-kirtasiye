begin;
select set_config('request.jwt.claims','{}',true);
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
create function pg_temp.expect_error(statement text,code text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then if sqlstate=code then raise notice 'PASS: %',label; return; end if; raise; end;
raise exception 'FAIL: %',label; end; $$;
create temp sequence pricing_phone;
create function pg_temp.check_parity(p_items jsonb,p_method text,p_coupon text,p_subtotal numeric,p_discount numeric,p_fee numeric,p_label text)
returns void language plpgsql as $$
declare q record; o record; v_phone text:='0555'||lpad(nextval('pg_temp.pricing_phone')::text,7,'0');
begin
 select * into q from public.quote_order_savings(p_items,p_method,p_coupon,v_phone,null);
 select * into o from public.submit_order_request_with_auto_discounts('Pricing buyer',v_phone,'Istanbul','Bagcilar','Test address 123','',p_items,
  true,true,'2026-10-24-v2',p_method,null,'{"buyerType":"individual","recipientName":"Pricing buyer","city":"Istanbul","district":"Bagcilar","address":"Test address 123"}',p_coupon);
 perform pg_temp.assert_true(q.subtotal=p_subtotal and q.discount_amount=p_discount and q.shipping_fee=p_fee and q.total=p_subtotal-p_discount+p_fee,p_label||' expected quote');
 perform pg_temp.assert_true(q.subtotal=o.subtotal and q.discount_amount=o.discount_amount and q.shipping_fee=o.shipping_fee and q.total=o.total
  and q.code is not distinct from o.code and q.campaign_name is not distinct from o.campaign_name,p_label||' checkout parity');
 perform pg_temp.assert_true((select sum(i.line_total)=o.subtotal from public.order_request_items i where i.order_request_id=o.id),p_label||' immutable line sum');
end; $$;

insert into public.categories(id,name,slug) values('60000000-0000-0000-0000-000000000001','Root','pricing-root');
insert into public.categories(id,parent_id,name,slug) values('60000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','Child','pricing-child');
insert into public.products(id,category_id,slug,name,price,stock_quantity,is_active) values
 ('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','pricing-pencil','Pricing pencil',100,20,true),
 ('20000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002','pricing-variants','Variant pencil',5,0,true);
insert into public.product_variants(id,product_id,color,size,price,stock_quantity) values
 ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Red','M',150,10),
 ('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Blue','L',200,10);
update public.store_settings set shipping_enabled=true,pickup_enabled=true,shipping_flat_fee=20,free_shipping_threshold=100 where id=1;
update public.automatic_campaigns set is_active=false;
insert into public.coupons(id,code,label,discount_type,discount_value,max_discount) values
 ('30000000-0000-0000-0000-000000000001','PRICING_FIXED','Fixed','fixed',20,null),
 ('30000000-0000-0000-0000-000000000002','PRICING_CAP','Capped percent','percent',50,25),
 ('30000000-0000-0000-0000-000000000003','PRICING_FULL','Full discount','fixed',1000,null);
insert into public.automatic_campaigns(id,name,scope,discount_type,discount_value,min_subtotal,priority,is_active)
 values('80000000-0000-0000-0000-000000000001','Basket campaign','order','fixed',20,0,0,false);

select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping',null,100,0,0,'threshold equality');
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','PRICING_FIXED',100,20,20,'coupon removes free shipping');
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','pickup','PRICING_FIXED',100,20,0,'pickup excludes shipping');
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','PRICING_CAP',100,25,20,'percent cap');
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','PRICING_FULL',100,100,20,'discount cannot exceed subtotal');
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000002","variantId":"70000000-0000-0000-0000-000000000001","quantity":1},
 {"productId":"20000000-0000-0000-0000-000000000002","variantId":"70000000-0000-0000-0000-000000000002","quantity":1}]','shipping',null,350,0,0,'multiple variants use their own prices');
select pg_temp.assert_true((select bool_and(unit_price in(150,200) and variant_label in('Red / M','Blue / L')) from public.order_request_items where product_id='20000000-0000-0000-0000-000000000002'),'variant labels and prices are snapshotted');

update public.automatic_campaigns set is_active=true where id='80000000-0000-0000-0000-000000000001';
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','PRICING_FIXED',100,20,20,'equal coupon retains automatic campaign');
select pg_temp.assert_true(not exists(select 1 from public.order_requests where phone like '0555%' and coupon_code='PRICING_FIXED' and automatic_campaign_id is not null),'coupon and automatic campaign never stack');
update public.automatic_campaigns set discount_value=30 where id='80000000-0000-0000-0000-000000000001';
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping','PRICING_FIXED',100,30,20,'higher automatic discount wins');
update public.automatic_campaigns set discount_value=10,scope='category',category_id='60000000-0000-0000-0000-000000000001' where id='80000000-0000-0000-0000-000000000001';
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping',null,100,10,20,'ancestor category campaign');
update public.automatic_campaigns set min_subtotal=200 where id='80000000-0000-0000-0000-000000000001';
select pg_temp.check_parity('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping',null,100,0,0,'minimum basket not reached');

select pg_temp.expect_error($q$select * from public.quote_order_savings('[{"productId":"20000000-0000-0000-0000-000000000002","quantity":1}]','pickup')$q$,'22023','variant selection required');
select pg_temp.expect_error($q$select * from public.quote_order_savings('[{"productId":"20000000-0000-0000-0000-000000000001","variantId":"70000000-0000-0000-0000-000000000001","quantity":1}]','pickup')$q$,'22023','variant cannot be attached to a standard product');
select pg_temp.expect_error($q$select * from public.quote_order_savings('[{"productId":"20000000-0000-0000-0000-000000000002","variantId":"70000000-0000-0000-0000-000000000001","quantity":11}]','pickup')$q$,'22023','variant stock checked in shared snapshot');
select pg_temp.expect_error($q$select * from public.quote_order_savings('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1},{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','pickup')$q$,'22023','duplicate lines rejected');
update public.store_settings set shipping_enabled=false where id=1;
select pg_temp.expect_error($q$select * from public.quote_order_savings('[{"productId":"20000000-0000-0000-0000-000000000001","quantity":1}]','shipping')$q$,'22023','disabled shipping rejected');
select pg_temp.assert_true(not has_function_privilege('anon','private.checkout_catalog_snapshot(jsonb,boolean)','execute') and not has_function_privilege('authenticated','private.order_savings(jsonb,numeric,text,text,text,uuid,boolean)','execute'),'shared helpers remain private');
rollback;
