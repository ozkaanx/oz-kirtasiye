-- Recovered from the hosted migration ledger; original version retained.

create index if not exists products_catalog_order_idx on public.products(is_featured desc,created_at desc,id desc) where is_active;
create index if not exists products_catalog_newest_idx on public.products(created_at desc,id desc) where is_active;
create index if not exists product_variants_catalog_filter_idx on public.product_variants(product_id,color,size,price) where is_active;
create index if not exists automatic_campaigns_catalog_product_idx on public.automatic_campaigns(product_id) where is_active and scope='product';
create index if not exists automatic_campaigns_catalog_category_idx on public.automatic_campaigns(category_id) where is_active and scope='category';

create or replace function public.catalog_search_page(
p_category text default 'all',p_q text default '',p_sort text default 'featured',
p_min numeric default null,p_max numeric default null,p_color text default '',p_size text default '',
p_stock boolean default false,p_campaign boolean default false,p_page integer default 1,p_page_size integer default 24
)
returns table(product_id uuid,variant_id uuid,display_price numeric,matched_stock integer,total_count bigint)
language plpgsql stable security invoker set search_path=''
as $function$
begin
 if p_category is null or char_length(p_category)>100
 or p_q is null or char_length(p_q)>120
 or p_color is null or char_length(p_color)>100
 or p_size is null or char_length(p_size)>100
 or p_sort is null or p_sort not in ('featured','newest','price-asc','price-desc','name')
 or p_min<0 or p_max<0 or p_min>10000000 or p_max>10000000
 or (p_min is not null and p_max is not null and p_min>p_max)
 or p_page is null or p_page<1 or p_page>100000
 or p_page_size is null or p_page_size<1 or p_page_size>48
 then raise exception 'Geçersiz katalog filtresi veya sayfa.' using errcode='22023'; end if;
 return query
 with recursive ancestors as (
  select c.id descendant_id,c.id ancestor_id,c.parent_id,c.name,0 depth from public.categories c
  union all
  select a.descendant_id,c.id,c.parent_id,c.name,a.depth+1
  from ancestors a join public.categories c on c.id=a.parent_id where a.depth<20
 ),
 requested_category as (select c.id from public.categories c where c.slug=p_category and c.is_active),
 words as (
  select word from regexp_split_to_table(
   pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(p_q)),'çğıöşü','cgiosu'),'[[:space:]]+') word
  where word<>''
 ),
 products_prepared as (
  select p.id,p.name,p.description,p.category_id,p.price,p.stock_quantity,p.has_variants,p.created_at,p.is_featured,
   coalesce(anc.ancestor_ids,'{}'::uuid[]) ancestor_ids,
   pg_catalog.translate(pg_catalog.lower(pg_catalog.concat_ws(' ',p.name,p.description,anc.category_names)),
    'çğıöşü','cgiosu') base_terms,
   pg_catalog.translate(pg_catalog.lower(pg_catalog.concat_ws(' ',p.name,p.description,anc.category_names,vars.all_variant_terms)),
    'çğıöşü','cgiosu') full_terms
  from public.products p
  left join lateral (
   select pg_catalog.array_agg(a.ancestor_id) ancestor_ids,
    pg_catalog.string_agg(a.name,' ') category_names
   from ancestors a where a.descendant_id=p.category_id
  ) anc on true
  left join lateral (
   select pg_catalog.string_agg(pg_catalog.concat_ws(' ',v.color,v.size),' ') all_variant_terms
   from public.product_variants v where v.product_id=p.id and v.is_active
  ) vars on p.has_variants
  where p.is_active and (p_category='all' or exists(
   select 1 from requested_category rc join ancestors ca on ca.ancestor_id=rc.id
   where ca.descendant_id=p.category_id))
 ),
 matched_products as (
  select p.* from products_prepared p
  where not exists(select 1 from words w where pg_catalog.strpos(p.full_terms,w.word)=0)
 ),
 items as (
  select p.id product_id,p.name,p.price base_price,p.stock_quantity base_stock,
   p.has_variants,p.created_at,p.is_featured,p.ancestor_ids,p.base_terms,v.id variant_id,
   case when p.has_variants and v.id is not null then v.price else p.price end item_price,
   case when p.has_variants then coalesce(v.stock_quantity,0) else p.stock_quantity end item_stock,
   coalesce(v.color,'') color,coalesce(v.size,'') size
  from matched_products p
  left join public.product_variants v on p.has_variants and v.product_id=p.id and v.is_active
 ),
 candidates as (
  select i.*,
   (select least(i.item_price,coalesce(c.max_discount,i.item_price),
     case when c.discount_type='percent' then pg_catalog.round(i.item_price*c.discount_value/100,2)
      else c.discount_value end)
    from public.automatic_campaigns c
    where i.item_stock>0 and c.is_active and now()>=c.starts_at and (c.expires_at is null or now()<c.expires_at)
     and i.item_price>=c.min_subtotal
     and ((c.scope='product' and c.product_id=i.product_id)
       or (c.scope='category' and c.category_id=any(i.ancestor_ids)))
    order by least(i.item_price,coalesce(c.max_discount,i.item_price),
       case when c.discount_type='percent' then pg_catalog.round(i.item_price*c.discount_value/100,2)
        else c.discount_value end) desc,c.priority desc,c.id
    limit 1) promo_discount,
   exists(select 1 from public.automatic_campaigns c
    where i.item_stock>0 and c.is_active and now()>=c.starts_at
      and (c.expires_at is null or now()<c.expires_at) and c.min_subtotal>i.item_price
      and ((c.scope='product' and c.product_id=i.product_id)
       or (c.scope='category' and c.category_id=any(i.ancestor_ids)))) has_basket_notice
  from items i
  where (p_color='' or pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(i.color)),'çğıöşü','cgiosu')
                 =pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(p_color)),'çğıöşü','cgiosu'))
    and (p_size='' or pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(i.size)),'çğıöşü','cgiosu')
                =pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(p_size)),'çğıöşü','cgiosu'))
    and (not p_stock or i.item_stock>0)
    and not exists(select 1 from words w where pg_catalog.strpos(i.base_terms,w.word)=0
     and pg_catalog.strpos(pg_catalog.translate(pg_catalog.lower(
      pg_catalog.concat_ws(' ',i.color,i.size)),'çğıöşü','cgiosu'),w.word)=0)
 ),
 eligible as (
  select c.*,c.item_price-coalesce(greatest(c.promo_discount,0),0) effective_price
  from candidates c
 ),
 ranked as (
  select e.*,pg_catalog.row_number() over(partition by e.product_id
    order by (e.item_stock>0) desc,e.effective_price asc,e.item_price asc,e.variant_id) variant_rank,
   (sum(e.item_stock) over(partition by e.product_id))::integer total_matching_stock
  from eligible e
  where (not p_campaign or (e.promo_discount>0 or e.has_basket_notice))
   and (p_min is null or e.effective_price>=p_min) and (p_max is null or e.effective_price<=p_max)
   and (not e.has_variants or e.variant_id is not null
      or (p_color='' and p_size='' and not p_stock and not p_campaign))
 ),
 ranked_products as (select r.* from ranked r where r.variant_rank=1),
 paged as (
  select r.product_id,r.variant_id,r.effective_price,r.total_matching_stock from ranked_products r
  order by
   case when p_sort='featured' then r.is_featured end desc nulls last,
   case when p_sort in ('featured','newest') then r.created_at end desc nulls last,
   case when p_sort='price-asc' then r.effective_price end asc nulls last,
   case when p_sort='price-desc' then r.effective_price end desc nulls last,
   case when p_sort='name' or p_sort in ('price-asc','price-desc') then r.name end collate "tr-TR-x-icu" asc nulls last,
   r.product_id asc
  limit p_page_size offset ((p_page::bigint-1)*p_page_size)
 )
 select paged.product_id,paged.variant_id,paged.effective_price,paged.total_matching_stock,
  (select count(*) from ranked_products)::bigint total_count
 from (select 1) one left join paged on true;
end;
$function$;
revoke all on function public.catalog_search_page(text,text,text,numeric,numeric,text,text,boolean,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.catalog_search_page(text,text,text,numeric,numeric,text,text,boolean,boolean,integer,integer) to service_role;

create or replace function public.catalog_category_facets(p_category text default 'all')
returns table(colors text[],sizes text[])
language sql stable security invoker set search_path=''
as $function$
with recursive descendants as (
 select c.id from public.categories c where c.slug=p_category and c.is_active
 union all
 select c.id from public.categories c join descendants d on c.parent_id=d.id where c.is_active
), options as (
 select nullif(pg_catalog.btrim(v.color),'') color,nullif(pg_catalog.btrim(v.size),'') size
 from public.product_variants v join public.products p on p.id=v.product_id
 where p.is_active and v.is_active and (p_category='all' or p.category_id in(select id from descendants))
)
select coalesce((select pg_catalog.array_agg(color order by color) from (select distinct color from options where color is not null) x),'{}'::text[]) colors,
 coalesce((select pg_catalog.array_agg(size order by size) from (select distinct size from options where size is not null) x),'{}'::text[]) sizes;
$function$;
revoke all on function public.catalog_category_facets(text) from public,anon,authenticated;
grant execute on function public.catalog_category_facets(text) to service_role;
