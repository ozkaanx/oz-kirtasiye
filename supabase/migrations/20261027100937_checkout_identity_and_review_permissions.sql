-- API routes verify the cookie session with auth.getUser(), then call a
-- service-role-only RPC with that verified user ID. The service client has no
-- customer JWT, so auth.uid() is NULL here even for a signed-in customer.
-- Never grant the enclosing quote/checkout RPCs to anon/authenticated.
create or replace function private.coupon_discount(
 p_code text,p_subtotal numeric,p_phone text,p_user_id uuid,p_lock boolean default false
)
returns table(coupon_id uuid,code text,amount numeric)
language plpgsql security invoker set search_path = '' as $$
declare v_coupon_id uuid; v_assignee uuid;
begin
 select c.id into v_coupon_id from public.coupons c
 where c.code=upper(pg_catalog.btrim(coalesce(p_code,'')));
 if v_coupon_id is not null then
  select a.user_id into v_assignee from public.coupon_private_assignments a
  where a.coupon_id=v_coupon_id;
  if v_assignee is not null and p_user_id is distinct from v_assignee then
   raise exception 'Bu kupon yalnızca atandığı müşteri hesabıyla kullanılabilir.' using errcode='22023';
  end if;
 end if;
 return query select t.coupon_id,t.code,t.amount
 from private.coupon_discount_unrestricted(p_code,p_subtotal,p_phone,p_user_id,p_lock) t;
end;
$$;
revoke all on function private.coupon_discount(text,numeric,text,uuid,boolean) from public,anon,authenticated;

-- Browser writes must go through submit_product_review / moderate_product_review.
-- Their product ownership / admin checks cannot be bypassed by direct REST writes.
revoke insert,update on public.product_reviews from authenticated;
drop policy if exists reviews_verified_insert on public.product_reviews;

-- Anonymous read policies must not query the authenticated-only admin table.
-- Keep admin/owner reads for authenticated users and separate the public branch.
alter policy reviews_public_or_owned_select on public.product_reviews to authenticated;
create policy reviews_approved_public_select on public.product_reviews
 for select to anon using (status='approved');
alter policy categories_visible_to_public_and_admins on public.categories to authenticated;
create policy categories_active_public_select on public.categories
 for select to anon using (is_active);
alter policy products_visible_to_public_and_admins on public.products to authenticated;
create policy products_active_public_select on public.products
 for select to anon using (is_active);
alter policy variant_public_or_admin_select on public.product_variants to authenticated;
create policy variants_active_public_select on public.product_variants
 for select to anon using (
  is_active and exists(select 1 from public.products p where p.id=product_id and p.is_active)
 );
