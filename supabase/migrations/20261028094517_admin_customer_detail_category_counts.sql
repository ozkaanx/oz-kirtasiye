create function public.admin_customer_orders(p_customer uuid,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';end if;
 if p_customer is null or p_page is null or p_page not between 1 and 1000000 then
  raise exception 'Müşteri veya sayfa geçersiz.' using errcode='22023';end if;
 with matched as materialized (
  select id,reference,customer_name,phone,status,total,created_at,delivery_method from public.order_requests where customer_user_id=p_customer
 ), counts as (
  select count(*) as total,count(*) filter(where status<>'cancelled') as active,
   coalesce(sum(total) filter(where status<>'cancelled'),0) as amount,
   least(p_page,greatest(1,ceil(count(*)/25.0)::integer)) as page from matched
 ), page_rows as (
  select id,reference,status,total,created_at,delivery_method from matched order by created_at desc,id desc limit 25 offset(select (page-1)*25 from counts)
 ), latest as (
  select customer_name,phone,created_at from matched order by created_at desc,id desc limit 1
 ) select jsonb_build_object(
  'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) from page_rows r),
  'latest',(select to_jsonb(l) from latest l),'total',c.total,'active',c.active,'amount',c.amount,
  'page',c.page,'pageSize',25,'hasPrevious',c.page>1,'hasNext',c.page*25<c.total
 ) into v_result from counts c;
 return v_result;
end;$$;
revoke all on function public.admin_customer_orders(uuid,integer) from public,anon;
grant execute on function public.admin_customer_orders(uuid,integer) to authenticated;

create function public.admin_category_catalog()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';end if;
 with counts as (select category_id,count(*) as n from public.products where category_id is not null group by category_id),
 categories as (select id,parent_id,name,slug,description,image_path,sort_order,is_active from public.categories)
 select jsonb_build_object('categories',(select coalesce(jsonb_agg(to_jsonb(c) order by sort_order,id),'[]'::jsonb) from categories c),
 'productCounts',(select coalesce(jsonb_object_agg(c.id::text,coalesce(p.n,0)),'{}'::jsonb) from categories c left join counts p on p.category_id=c.id)) into v_result;
 return v_result;
end;$$;
revoke all on function public.admin_category_catalog() from public,anon;
grant execute on function public.admin_category_catalog() to authenticated;
