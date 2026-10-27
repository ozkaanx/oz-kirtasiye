-- Recovered from the hosted migration ledger; original version retained.

create or replace function public.catalog_campaign_previews_batch(p_product_ids uuid[])
returns table(product_id uuid,variant_id uuid,campaign_id uuid,campaign_name text,original_price numeric,discount_amount numeric,discounted_price numeric)
language sql stable security invoker set search_path=''
as $fn$
select x.product_id,x.variant_id,x.campaign_id,x.campaign_name,x.original_price,x.discount_amount,x.discounted_price
from unnest(p_product_ids[1:48]) as ids(product_id)
cross join lateral public.catalog_campaign_previews(ids.product_id) x;
$fn$;
revoke all on function public.catalog_campaign_previews_batch(uuid[]) from public,anon,authenticated;
grant execute on function public.catalog_campaign_previews_batch(uuid[]) to service_role;

create or replace function public.catalog_campaign_notices_batch(p_product_ids uuid[])
returns table(product_id uuid,variant_id uuid,campaign_name text,min_subtotal numeric,discount_type text,discount_value numeric,max_discount numeric)
language sql stable security invoker set search_path=''
as $fn$
select x.product_id,x.variant_id,x.campaign_name,x.min_subtotal,x.discount_type,x.discount_value,x.max_discount
from unnest(p_product_ids[1:48]) as ids(product_id)
cross join lateral public.catalog_campaign_notices(ids.product_id) x;
$fn$;
revoke all on function public.catalog_campaign_notices_batch(uuid[]) from public,anon,authenticated;
grant execute on function public.catalog_campaign_notices_batch(uuid[]) to service_role;
