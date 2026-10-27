-- Recovered from the hosted migration ledger; original version retained.

create or replace function private.best_automatic_campaign(p_lines jsonb,p_subtotal numeric)
returns table(campaign_id uuid,campaign_name text,discount_amount numeric)
language sql stable security invoker set search_path=''
as $function$
with recursive descendant as (
 select c.id as root_id,c.id as descendant_id from public.categories c
 union all
 select d.root_id,child.id from public.categories child
 join descendant d on child.parent_id=d.descendant_id
),
lines as (
 select (item->>'productId')::uuid as product_id,
  (item->>'categoryId')::uuid as category_id,
  (item->>'lineTotal')::numeric as line_total
 from pg_catalog.jsonb_array_elements(p_lines) as item
),
eligible as (
 select c.id,c.name,c.discount_type,c.discount_value,c.max_discount,c.priority,
  coalesce(sum(case when c.scope='order' or
   (c.scope='product' and l.product_id=c.product_id) or
   (c.scope='category' and exists(
     select 1 from descendant d where d.root_id=c.category_id and d.descendant_id=l.category_id
   )) then l.line_total else 0 end),0) as applicable_total
 from public.automatic_campaigns c cross join lines l
 where c.is_active and now()>=c.starts_at
  and (c.expires_at is null or now()<c.expires_at)
  and p_subtotal>=c.min_subtotal
 group by c.id
),
calculated as (
 select e.id,e.name,e.priority,
  least(e.applicable_total,
   case when e.max_discount is null then 999999.99 else e.max_discount end,
   case when e.discount_type='percent'
     then round(e.applicable_total*e.discount_value/100,2)
     else e.discount_value end) as amount
 from eligible e
)
select x.id,x.name,x.amount from calculated x
where x.amount>0 order by x.amount desc,x.priority desc,x.id limit 1;
$function$;
revoke all on function private.best_automatic_campaign(jsonb,numeric) from public,anon,authenticated;
