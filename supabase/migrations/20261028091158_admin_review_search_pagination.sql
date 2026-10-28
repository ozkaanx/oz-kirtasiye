create function public.admin_search_reviews(p_query text default '',p_status text default 'pending',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text; v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 1000000 or char_length(coalesce(p_query,''))>100
  or p_status is null or p_status not in ('all','pending','approved','rejected') then
  raise exception 'Yorum filtreleri geçersiz.' using errcode='22023'; end if;
 v_pattern:='%'||replace(replace(replace(lower(translate(btrim(coalesce(p_query,'')),'IİÇĞÖŞÜ','ıiçğöşü')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with matched as materialized (
  select r.id,r.product_id,coalesce(p.name,'Ürün') as product_name,r.rating,r.body,r.status,r.created_at
  from public.product_reviews r left join public.products p on p.id=r.product_id
  where (p_status='all' or r.status=p_status) and
   (v_pattern='%%' or lower(translate(coalesce(p.name,'')||' '||r.body,'IİÇĞÖŞÜ','ıiçğöşü')) like v_pattern escape E'\\')
 ), counts as (
  select count(*) as total,least(p_page,greatest(1,ceil(count(*)/25.0)::integer)) as page from matched
 ), page_rows as (
  select r.* from matched r order by created_at desc,id desc
  limit 25 offset (select (page-1)*25 from counts)
 ) select jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) from page_rows r),
  'total',c.total,'page',c.page,'pageSize',25,'hasPrevious',c.page>1,'hasNext',c.page*25<c.total,
  'stats',(select jsonb_build_object('all',count(*),'pending',count(*) filter(where status='pending'),
   'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected'),
   'average',avg(rating) filter(where status='approved')) from public.product_reviews)
 ) into v_result from counts c;
 return v_result;
end; $$;
revoke all on function public.admin_search_reviews(text,text,integer) from public,anon;
grant execute on function public.admin_search_reviews(text,text,integer) to authenticated;
