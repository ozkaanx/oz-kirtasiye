-- Read-only, service-role-only per-unit preview for product/category campaigns.
-- Basket-scoped campaigns and coupon codes are intentionally not included.
-- Final payable amount is always recalculated by the checkout RPC.
create or replace function public.catalog_campaign_previews(p_product_id uuid default null)
returns table(
 product_id uuid, variant_id uuid, campaign_id uuid, campaign_name text,
 original_price numeric, discount_amount numeric, discounted_price numeric
)
language sql stable security invoker set search_path = ''
as $function$
with recursive ancestors as (
 select c.id as product_category_id, c.id as ancestor_id, c.parent_id, 0 as depth
 from public.categories c
 union all
 select a.product_category_id, parent.id, parent.parent_id, a.depth+1
 from ancestors a join public.categories parent on parent.id=a.parent_id
 where a.depth<20
),
priced_items as (
 select p.id as product_id, null::uuid as variant_id, p.category_id, p.price as original_price
 from public.products p
 where p.is_active and not p.has_variants and p.stock_quantity>0
   and (p_product_id is null or p.id=p_product_id)
 union all
 select p.id, v.id, p.category_id, v.price
 from public.products p join public.product_variants v on v.product_id=p.id
 where p.is_active and p.has_variants and v.is_active and v.stock_quantity>0
   and (p_product_id is null or p.id=p_product_id)
),
offers as (
 select i.product_id,i.variant_id,c.id as campaign_id,c.name as campaign_name,
  i.original_price,
  least(
   i.original_price,
   coalesce(c.max_discount,i.original_price),
   case when c.discount_type='percent'
     then round(i.original_price*c.discount_value/100,2)
     else c.discount_value end
  ) as discount_amount,
  c.priority
 from priced_items i join public.automatic_campaigns c
   on c.is_active and now()>=c.starts_at
   and (c.expires_at is null or now()<c.expires_at)
   and i.original_price>=c.min_subtotal
   and (
     (c.scope='product' and c.product_id=i.product_id)
     or
     (c.scope='category' and exists(
       select 1 from ancestors a
       where a.product_category_id=i.category_id and a.ancestor_id=c.category_id
     ))
   )
),
ranked as (
 select o.*,row_number() over(
   partition by o.product_id,o.variant_id
   order by o.discount_amount desc,o.priority desc,o.campaign_id
 ) as rank
 from offers o where o.discount_amount>0
)
select r.product_id,r.variant_id,r.campaign_id,r.campaign_name,
 r.original_price,r.discount_amount,r.original_price-r.discount_amount as discounted_price
from ranked r where r.rank=1;
$function$;
revoke all on function public.catalog_campaign_previews(uuid) from public,anon,authenticated;
grant execute on function public.catalog_campaign_previews(uuid) to service_role;
