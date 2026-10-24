-- Minimum-cart promotional notices for product and category campaigns.
-- This is a server-only read-only RPC; no campaign admin data is exposed directly.
-- This migration has ALREADY been applied on Supabase; commit it for history only.
create or replace function public.catalog_campaign_notices(p_product_id uuid default null)
returns table (
 product_id uuid, variant_id uuid, campaign_name text, min_subtotal numeric,
 discount_type text, discount_value numeric, max_discount numeric
)
language sql stable security invoker set search_path=''
as $function$
with recursive category_ancestors as (
 select c.id as descendant_id,c.id as ancestor_id,c.parent_id,0 as depth
 from public.categories c
 union all
 select a.descendant_id,p.id,p.parent_id,a.depth+1
 from category_ancestors a
 join public.categories p on p.id=a.parent_id
 where a.depth<20
),
items as (
 select p.id as product_id,null::uuid as variant_id,p.category_id,p.price as price
 from public.products p
 where p.is_active and not p.has_variants and p.stock_quantity>0
   and (p_product_id is null or p.id=p_product_id)
 union all
 select p.id,v.id,p.category_id,v.price
 from public.products p
 join public.product_variants v on v.product_id=p.id
 where p.is_active and p.has_variants and v.is_active and v.stock_quantity>0
   and (p_product_id is null or p.id=p_product_id)
),
offers as (
 select i.product_id,i.variant_id,c.name as campaign_name,c.min_subtotal,
  c.discount_type,c.discount_value,c.max_discount,c.priority,c.id as campaign_id,
  least(i.price,coalesce(c.max_discount,i.price),
    case when c.discount_type='percent' then round(i.price*c.discount_value/100,2)
      else c.discount_value end) as potential_saving
 from items i
 join public.automatic_campaigns c on
   c.is_active and now()>=c.starts_at
   and (c.expires_at is null or now()<c.expires_at)
   and c.min_subtotal>i.price and c.min_subtotal>0
   and (
     (c.scope='product' and c.product_id=i.product_id)
     or
     (c.scope='category' and exists(
       select 1 from category_ancestors a
       where a.descendant_id=i.category_id and a.ancestor_id=c.category_id
     ))
   )
),
ranked as (
 select o.*,row_number() over(
  partition by o.product_id,o.variant_id
  order by o.min_subtotal asc,o.potential_saving desc,o.priority desc,o.campaign_id
 ) as rn from offers o where o.potential_saving>0
)
select r.product_id,r.variant_id,r.campaign_name,r.min_subtotal,
 r.discount_type,r.discount_value,r.max_discount
from ranked r where r.rn=1;
$function$;
revoke all on function public.catalog_campaign_notices(uuid) from public,anon,authenticated;
grant execute on function public.catalog_campaign_notices(uuid) to service_role;
