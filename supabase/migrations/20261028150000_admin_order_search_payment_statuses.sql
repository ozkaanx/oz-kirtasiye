-- Aşama 31: align admin order search with the 29.1 payment reservation states.
-- Preserve the original invoker-security, RLS, cursor paging and filtering logic.
-- No payment capture or fulfillment transitions are enabled by this migration.
-- This file deliberately replaces the function body, not the data model.

create or replace function public.admin_search_orders(
 p_query text default '',p_status text default null,p_delivery text default null,
 p_from date default null,p_to date default null,p_cursor_time timestamptz default null,
 p_cursor_id uuid default null,p_direction text default 'after',p_limit integer default 25
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text; v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_direction is null or p_direction not in ('after','before')
  or (p_cursor_time is null)<>(p_cursor_id is null) or (p_direction='before' and p_cursor_id is null)
  or char_length(coalesce(p_query,''))>100
  or (p_status is not null and p_status not in ('new','contacted','awaiting_payment','paid','processing','shipped','delivered','completed','cancelled'))
  or (p_delivery is not null and p_delivery not in ('shipping','pickup','legacy'))
  or (p_from is not null and p_to is not null and p_from>p_to) then
  raise exception 'Sipariş filtreleri geçersiz.' using errcode='22023'; end if;
 -- Treat %, _ and backslash as literal search text, never wildcard instructions.
 v_pattern:='%'||replace(replace(replace(lower(translate(btrim(coalesce(p_query,'')),'IİÇĞÖŞÜ','ıiçğöşü')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with matched as not materialized (
  select o.* from public.order_requests o
  where (p_status is null or o.status=p_status) and (p_delivery is null or o.delivery_method=p_delivery)
   and (p_from is null or o.created_at>=p_from::timestamp at time zone 'Europe/Istanbul')
   and (p_to is null or o.created_at<(p_to+1)::timestamp at time zone 'Europe/Istanbul')
   and (v_pattern='%%' or lower(translate(o.reference||' '||o.customer_name||' '||o.phone||' '||o.city||' '||o.district||' '||coalesce(o.coupon_code,'')||' '||coalesce(o.automatic_campaign_name,''),'IİÇĞÖŞÜ','ıiçğöşü')) like v_pattern escape E'\\')
 ), page as materialized (
  select o.* from matched o where p_cursor_id is null
   or (p_direction='after' and (o.created_at,o.id)<(p_cursor_time,p_cursor_id))
   or (p_direction='before' and (o.created_at,o.id)>(p_cursor_time,p_cursor_id))
  order by case when p_direction='before' then o.created_at end asc,
   case when p_direction='before' then o.id end asc,o.created_at desc,o.id desc limit p_limit
 ), records as (
  select o.created_at,o.id,jsonb_build_object(
   'id',o.id,'reference',o.reference,'customer_name',o.customer_name,'phone',o.phone,
   'city',o.city,'district',o.district,'address',o.address,'note',o.note,'status',o.status,
   'payment_status',o.payment_status,'subtotal',o.subtotal,'discount_amount',o.discount_amount,
   'coupon_code',o.coupon_code,'automatic_campaign_name',o.automatic_campaign_name,
   'delivery_method',o.delivery_method,'shipping_fee',o.shipping_fee,'total',o.total,
   'created_at',o.created_at,'carrier',o.carrier,'tracking_number',o.tracking_number,
   'shipped_at',o.shipped_at,'delivered_at',o.delivered_at,'inventory_deducted_at',o.inventory_deducted_at,
   'inventory_restored_at',o.inventory_restored_at,'cancellation_reason',o.cancellation_reason,
   'order_request_items',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,'variant_label',i.variant_label,'unit_price',i.unit_price,'quantity',i.quantity,'line_total',i.line_total) order by i.id),'[]') from public.order_request_items i where i.order_request_id=o.id),
   'order_request_status_history',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'from_status',h.from_status,'to_status',h.to_status,'note',h.note,'created_at',h.created_at) order by h.created_at,h.id),'[]') from public.order_request_status_history h where h.order_request_id=o.id)
  ) value from page o
 ) select jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(r.value order by r.created_at desc,r.id desc),'[]') from records r),
  'total',(select count(*) from matched),
  'hasPrevious',exists(select 1 from matched m where (m.created_at,m.id)>(select p.created_at,p.id from page p order by p.created_at desc,p.id desc limit 1)),
  'hasNext',exists(select 1 from matched m where (m.created_at,m.id)<(select p.created_at,p.id from page p order by p.created_at,p.id limit 1)),
  'stats',(select jsonb_build_object('total',count(*),'new',count(*) filter(where status='new'),'processing',count(*) filter(where status='processing'),'shipped',count(*) filter(where status='shipped')) from public.order_requests)
 ) into v_result;
 return v_result;
end;
$$;
revoke all on function public.admin_search_orders(text,text,text,date,date,timestamptz,uuid,text,integer) from public,anon;
grant execute on function public.admin_search_orders(text,text,text,date,date,timestamptz,uuid,text,integer) to authenticated;


