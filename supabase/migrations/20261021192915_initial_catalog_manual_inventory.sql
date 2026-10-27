-- Recovered from the hosted migration ledger; original version retained.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.store_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'manager' check (role in ('owner','manager')),
 created_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.categories(id) on delete set null,
 name text not null check (length(trim(name)) > 0),
 slug text not null unique check (length(trim(slug)) > 0),
 description text,
 image_path text,
 sort_order integer not null default 0,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint category_not_own_parent check (parent_id is distinct from id)
);
create table public.products (
 id uuid primary key default gen_random_uuid(),
 category_id uuid references public.categories(id) on delete set null,
 sku text unique,
 slug text not null unique check (length(trim(slug)) > 0),
 name text not null check (length(trim(name)) > 0),
 description text,
 price numeric(12,2) not null check (price >= 0),
 compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
 stock_quantity integer not null default 0 check (stock_quantity >= 0),
 low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
 is_active boolean not null default false,
 is_featured boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.product_images (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 storage_path text not null check (length(trim(storage_path)) > 0),
 alt_text text,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(product_id, storage_path)
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 quantity_before integer not null check (quantity_before >= 0),
 change_quantity integer not null check (change_quantity <> 0),
 quantity_after integer not null check (quantity_after >= 0),
 reason text not null check (reason in ('initial','manual_adjustment','system')),
 note text,
 changed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint movement_arithmetic check (quantity_after = quantity_before + change_quantity)
);
create index idx_categories_parent_sort on public.categories(parent_id,sort_order);
create index idx_products_category_active on public.products(category_id,is_active);
create index idx_products_active_featured on public.products(is_active,is_featured);
create index idx_product_images_product_sort on public.product_images(product_id,sort_order);
create index idx_stock_movements_product_created on public.stock_movements(product_id,created_at desc);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at = now();
 return new;
end;
$$;
create trigger categories_touch_updated_at before update on public.categories
for each row execute function private.touch_updated_at();
create trigger products_touch_updated_at before update on public.products
for each row execute function private.touch_updated_at();

create function private.audit_stock_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'INSERT' and new.stock_quantity > 0 then
  insert into public.stock_movements(product_id,quantity_before,change_quantity,quantity_after,reason,changed_by)
  values(new.id,0,new.stock_quantity,new.stock_quantity,'initial',auth.uid());
 elsif TG_OP = 'UPDATE' and old.stock_quantity is distinct from new.stock_quantity then
  insert into public.stock_movements(product_id,quantity_before,change_quantity,quantity_after,reason,changed_by)
  values(new.id,old.stock_quantity,new.stock_quantity-old.stock_quantity,new.stock_quantity,
    case when auth.uid() is null then 'system' else 'manual_adjustment' end,auth.uid());
 end if;
 return new;
end;
$$;
revoke execute on function private.touch_updated_at() from public, anon, authenticated;
revoke execute on function private.audit_stock_change() from public, anon, authenticated;
create trigger products_audit_stock after insert or update of stock_quantity on public.products
for each row execute function private.audit_stock_change();

alter table public.store_admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.store_admins, public.categories, public.products, public.product_images, public.stock_movements from anon,authenticated;
grant select on public.categories,public.products,public.product_images to anon;
grant select,insert,update,delete on public.categories,public.products,public.product_images to authenticated;
grant select on public.store_admins,public.stock_movements to authenticated;

create policy store_admin_self_read on public.store_admins
for select to authenticated using (user_id = (select auth.uid()));

create policy categories_visible_to_public_and_admins on public.categories
for select to anon,authenticated
using (is_active or exists (
 select 1 from public.store_admins a where a.user_id = (select auth.uid())
));
create policy categories_admin_insert on public.categories for insert to authenticated
with check (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy categories_admin_update on public.categories for update to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy categories_admin_delete on public.categories for delete to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));

create policy products_visible_to_public_and_admins on public.products for select to anon,authenticated
using (is_active or exists (
 select 1 from public.store_admins a where a.user_id = (select auth.uid())
));
create policy products_admin_insert on public.products for insert to authenticated
with check (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy products_admin_update on public.products for update to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy products_admin_delete on public.products for delete to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));

create policy images_visible_to_public_and_admins on public.product_images for select to anon,authenticated
using (exists (select 1 from public.products p where p.id=product_id));
create policy images_admin_insert on public.product_images for insert to authenticated
with check (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy images_admin_update on public.product_images for update to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy images_admin_delete on public.product_images for delete to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));

create policy stock_movements_admin_read on public.stock_movements for select to authenticated
using (exists (select 1 from public.store_admins a where a.user_id=(select auth.uid())));
