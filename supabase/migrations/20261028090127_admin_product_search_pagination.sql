create collation if not exists public.admin_product_tr (provider = icu, locale = 'tr-TR');

create function public.admin_search_products(
 p_query text default '', p_category uuid default null, p_visibility text default 'all',
 p_stock text default 'all', p_sort text default 'name', p_page integer default 1
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text; v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 1000000 or char_length(coalesce(p_query,''))>100
  or p_visibility is null or p_visibility not in ('all','active','inactive')
  or p_stock is null or p_stock not in ('all','available','low','out')
  or p_sort is null or p_sort not in ('name','priceAsc','priceDesc','stockAsc','stockDesc') then
  raise exception 'Ürün filtreleri geçersiz.' using errcode='22023'; end if;
 v_pattern:='%'||replace(replace(replace(lower(translate(btrim(coalesce(p_query,'')),'IİÇĞÖŞÜ','ıiçğöşü')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with recursive category_tree as (
  select c.id from public.categories c where c.id=p_category
  union
  select c.id from public.categories c join category_tree t on c.parent_id=t.id
 ), variant_totals as (
  select v.product_id, sum(v.stock_quantity)::bigint as stock,
   coalesce(min(v.price) filter(where v.stock_quantity>0),min(v.price)) as price
  from public.product_variants v where v.is_active group by v.product_id
 ), catalog as materialized (
  select p.*, case when p.has_variants then coalesce(v.stock,0) else p.stock_quantity end as display_stock,
   case when p.has_variants then coalesce(v.price,p.price) else p.price end as display_price
  from public.products p left join variant_totals v on v.product_id=p.id
 ), matched as materialized (
  select p.* from catalog p
  where (p_category is null or p.category_id in (select id from category_tree))
   and (p_visibility='all' or (p_visibility='active' and p.is_active) or (p_visibility='inactive' and not p.is_active))
   and (p_stock='all' or (p_stock='out' and p.display_stock=0)
    or (p_stock='low' and p.display_stock>0 and p.display_stock<=p.low_stock_threshold)
    or (p_stock='available' and p.display_stock>p.low_stock_threshold))
   and (v_pattern='%%' or lower(translate(p.name||' '||coalesce(p.sku,'')||' '||p.slug,'IİÇĞÖŞÜ','ıiçğöşü')) like v_pattern escape E'\\')
 ), counts as (
  select count(*) as total, least(p_page,greatest(1,ceil(count(*)/25.0)::integer)) as page from matched
 ), ordered as (
  select p.*, row_number() over(order by
   case when p_sort='priceAsc' then display_price end asc,
   case when p_sort='priceDesc' then display_price end desc,
   case when p_sort='stockAsc' then display_stock end asc,
   case when p_sort='stockDesc' then display_stock end desc,
   case when p_sort='name' then name end collate public.admin_product_tr asc, id asc) as position
  from matched p
 ), page_rows as (
  select p.* from ordered p, counts c where p.position>(c.page-1)*25 and p.position<=c.page*25
 ), records as (
  select p.position,jsonb_build_object(
   'id',p.id,'name',p.name,'slug',p.slug,'description',p.description,'category_id',p.category_id,'sku',p.sku,
   'price',p.display_price,'compare_at_price',p.compare_at_price,'stock_quantity',p.display_stock,
   'has_variants',p.has_variants,'low_stock_threshold',p.low_stock_threshold,'is_active',p.is_active,'is_featured',p.is_featured,
   'product_images',(select coalesce(jsonb_agg(jsonb_build_object('storage_path',i.storage_path,'sort_order',i.sort_order) order by i.sort_order,i.id),'[]'::jsonb) from public.product_images i where i.product_id=p.id)
  ) as item from page_rows p
 ) select jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(item order by position),'[]'::jsonb) from records),
  'total',c.total,'page',c.page,'pageSize',25,'hasPrevious',c.page>1,'hasNext',c.page*25<c.total,
  'stats',(select jsonb_build_object('total',count(*),'stock',coalesce(sum(display_stock),0),
   'low',count(*) filter(where display_stock>0 and display_stock<=low_stock_threshold),
   'out',count(*) filter(where display_stock=0)) from catalog)
 ) into v_result from counts c;
 return v_result;
end; $$;
revoke all on function public.admin_search_products(text,uuid,text,text,text,integer) from public,anon;
grant execute on function public.admin_search_products(text,uuid,text,text,text,integer) to authenticated;
