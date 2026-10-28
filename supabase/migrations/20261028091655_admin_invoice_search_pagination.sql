create function public.admin_search_invoices(p_query text default '',p_status text default 'all',p_from date default null,p_to date default null,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text;v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 or char_length(coalesce(p_query,''))>100
  or p_status is null or p_status not in ('all','pending','issued','legacy') or (p_from is not null and p_to is not null and p_from>p_to) then
  raise exception 'Fatura filtreleri geçersiz.' using errcode='22023';end if;
 v_pattern:='%'||replace(replace(replace(lower(translate(btrim(coalesce(p_query,'')),'IİÇĞÖŞÜ','ıiçğöşü')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with catalog as not materialized (
  select o.id,o.created_at,i.status as invoice_status,b.order_request_id is null as billing_missing,
   o.reference||' '||o.customer_name||' '||o.phone||' '||coalesce(b.recipient_name,'')||' '||coalesce(b.company_name,'')||' '||coalesce(i.invoice_number,'') as search_text
  from public.order_requests o left join public.order_billing_details b on b.order_request_id=o.id
  left join public.order_invoice_register i on i.order_request_id=o.id
 ), matched as materialized (
  select id,created_at from catalog where
   (p_status='all' or (p_status='legacy' and billing_missing) or invoice_status=p_status)
   and (p_from is null or created_at>=p_from::timestamp at time zone 'Europe/Istanbul')
   and (p_to is null or created_at<(p_to+1)::timestamp at time zone 'Europe/Istanbul')
   and (v_pattern='%%' or lower(translate(search_text,'IİÇĞÖŞÜ','ıiçğöşü')) like v_pattern escape E'\\')
 ), counts as (
  select count(*) as total,least(p_page,greatest(1,ceil(count(*)/25.0)::integer)) as page from matched
 ), page_ids as (
  select id,created_at from matched order by created_at desc,id desc limit 25 offset (select (page-1)*25 from counts)
 ), records as (
  select o.created_at,o.id,jsonb_build_object(
   'id',o.id,'reference',o.reference,'created_at',o.created_at,'customer_name',o.customer_name,'phone',o.phone,
   'status',o.status,'payment_status',o.payment_status,'delivery_method',o.delivery_method,'total',o.total,
   'discount_amount',o.discount_amount,'coupon_code',o.coupon_code,
   'billing',case when b.order_request_id is null then null else jsonb_build_object('buyer_type',b.buyer_type,
    'recipient_name',b.recipient_name,'company_name',b.company_name,'tax_office',b.tax_office,'tax_number',b.tax_number,
    'city',b.city,'district',b.district,'address',b.address) end,
   'invoice',case when i.order_request_id is null then null else jsonb_build_object('status',i.status,'document_type',i.document_type,
    'invoice_number',i.invoice_number,'issue_date',i.issue_date,'provider',i.provider,'recorded_at',i.recorded_at) end
  ) as item from page_ids p join public.order_requests o on o.id=p.id
  left join public.order_billing_details b on b.order_request_id=o.id
  left join public.order_invoice_register i on i.order_request_id=o.id
 ) select jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) from records),
  'total',c.total,'page',c.page,'pageSize',25,'hasPrevious',c.page>1,'hasNext',c.page*25<c.total,
  'stats',(select jsonb_build_object('total',count(*),'pending',count(*) filter(where invoice_status='pending'),
   'issued',count(*) filter(where invoice_status='issued'),'legacy',count(*) filter(where billing_missing)) from catalog)
 ) into v_result from counts c;
 return v_result;
end;$$;
revoke all on function public.admin_search_invoices(text,text,date,date,integer) from public,anon;
grant execute on function public.admin_search_invoices(text,text,date,date,integer) to authenticated;
