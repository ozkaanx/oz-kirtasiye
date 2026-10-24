-- Already applied on the connected Supabase project. Keep in git for schema history.
create table public.automatic_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(btrim(name)) between 3 and 100),
  scope text not null check(scope in('order','category','product')),
  category_id uuid references public.categories(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  discount_type text not null check(discount_type in('percent','fixed')),
  discount_value numeric(12,2) not null check(discount_value>0 and discount_value<=999999.99),
  max_discount numeric(12,2) check(max_discount is null or max_discount>0),
  min_subtotal numeric(12,2) not null default 0 check(min_subtotal>=0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  priority integer not null default 0 check(priority between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint auto_campaign_valid_window check(expires_at is null or expires_at>starts_at),
  constraint auto_campaign_percentage check(discount_type<>'percent' or discount_value<=100),
  constraint auto_campaign_target check(
    (scope='order' and category_id is null and product_id is null) or
    (scope='category' and category_id is not null and product_id is null) or
    (scope='product' and product_id is not null and category_id is null))
);
create index automatic_campaigns_schedule_idx on public.automatic_campaigns(is_active,starts_at,expires_at);
alter table public.automatic_campaigns enable row level security;
revoke all on public.automatic_campaigns from public,anon,authenticated;
grant select,insert,update on public.automatic_campaigns to authenticated;
create policy auto_campaign_admin_select on public.automatic_campaigns for select to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy auto_campaign_admin_insert on public.automatic_campaigns for insert to authenticated
 with check(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy auto_campaign_admin_update on public.automatic_campaigns for update to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())))
 with check(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
alter table public.order_requests
 add column automatic_campaign_id uuid references public.automatic_campaigns(id) on delete restrict,
 add column automatic_campaign_name text;
alter table public.order_requests drop constraint order_requests_coupon_snapshot_check;
alter table public.order_requests add constraint order_requests_discount_origin_check check (
 (discount_amount=0 and coupon_code is null and automatic_campaign_id is null and automatic_campaign_name is null) or
 (discount_amount>0 and coupon_code is not null and automatic_campaign_id is null and automatic_campaign_name is null) or
 (discount_amount>0 and coupon_code is null and automatic_campaign_id is not null and automatic_campaign_name is not null)
);
