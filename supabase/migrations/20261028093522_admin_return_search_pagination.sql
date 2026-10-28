create function public.admin_search_returns(p_query text default '',p_status text default 'all',p_kind text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text;v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 or char_length(coalesce(p_query,''))>100
  or p_status is null or p_status not in ('all','requested','approved','rejected','received','closed')
  or p_kind is null or p_kind not in ('all','return','exchange') then
  raise exception 'İade filtreleri geçersiz.' using errcode='22023';end if;
 v_pattern:='%'||replace(replace(replace(lower(translate(btrim(coalesce(p_query,'')),'IİÇĞÖŞÜ','ıiçğöşü')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with matched as materialized (
  select r.id,r.created_at from public.order_return_requests r
  left join public.order_requests o on o.id=r.order_request_id
  left join public.order_request_items line on line.id=r.order_item_id
  where (p_status='all' or r.status=p_status) and (p_kind='all' or r.request_type=p_kind)
   and (v_pattern='%%' or lower(translate(coalesce(o.reference,'')||' '||coalesce(o.customer_name,'')||' '||coalesce(o.phone,'')||' '||coalesce(line.product_name,'')||' '||coalesce(line.variant_label,''),'IİÇĞÖŞÜ','ıiçğöşü')) like v_pattern escape E'\\')
 ), counts as (
  select count(*) as total,least(p_page,greatest(1,ceil(count(*)/25.0)::integer)) as page from matched
 ), page_ids as (
  select id,created_at from matched order by created_at desc,id desc limit 25 offset (select (page-1)*25 from counts)
 ), records as (
  select r.id,r.created_at,jsonb_build_object(
   'id',r.id,'order_request_id',r.order_request_id,'order_item_id',r.order_item_id,'quantity',r.quantity,
   'request_type',r.request_type,'reason',r.reason,'customer_note',r.customer_note,'status',r.status,
   'admin_note',r.admin_note,'condition_on_receipt',r.condition_on_receipt,'restocked_quantity',r.restocked_quantity,
   'received_at',r.received_at,'created_at',r.created_at,
   'order',case when o.id is null then null else jsonb_build_object('reference',o.reference,'status',o.status,
    'customer_name',o.customer_name,'phone',o.phone,'inventory_deducted_at',o.inventory_deducted_at,
    'inventory_restored_at',o.inventory_restored_at,'invoice_issued',coalesce(invoice.status='issued',false)) end,
   'item',case when line.id is null then null else jsonb_build_object('product_name',line.product_name,'variant_label',line.variant_label,'quantity',line.quantity) end,
   'history',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'return_request_id',h.return_request_id,'from_status',h.from_status,'to_status',h.to_status,'note',h.note,'created_at',h.created_at) order by h.created_at,h.id),'[]'::jsonb) from public.order_return_status_history h where h.return_request_id=r.id)
  ) as item from page_ids p join public.order_return_requests r on r.id=p.id
  left join public.order_requests o on o.id=r.order_request_id
  left join public.order_request_items line on line.id=r.order_item_id
  left join public.order_invoice_register invoice on invoice.order_request_id=o.id
 ) select jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) from records),
  'total',c.total,'page',c.page,'pageSize',25,'hasPrevious',c.page>1,'hasNext',c.page*25<c.total,
  'stats',(select jsonb_build_object('total',count(*),'requested',count(*) filter(where status='requested'),
   'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected'),
   'received',count(*) filter(where status='received'),'closed',count(*) filter(where status='closed')) from public.order_return_requests)
 ) into v_result from counts c;
 return v_result;
end;$$;
revoke all on function public.admin_search_returns(text,text,text,integer) from public,anon;
grant execute on function public.admin_search_returns(text,text,text,integer) to authenticated;
