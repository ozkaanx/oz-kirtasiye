-- Recovered from the hosted migration ledger; original version retained.

alter table public.products add column if not exists has_variants boolean not null default false;
create table if not exists public.product_variants(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 sku text unique,
 color text not null default '' check(char_length(color)<=60),
 size text not null default '' check(char_length(size)<=60),
 price numeric(12,2) not null check(price>=0 and price<=999999.99),
 compare_at_price numeric(12,2) check(compare_at_price is null or compare_at_price>=0),
 stock_quantity integer not null default 0 check(stock_quantity>=0),
 low_stock_threshold integer not null default 5 check(low_stock_threshold>=0),
 image_path text,
 is_active boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint variant_has_option check(char_length(trim(color))>0 or char_length(trim(size))>0),
 constraint unique_variant_options unique(product_id,color,size)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id,sort_order);
create table if not exists public.variant_stock_movements(
 id uuid primary key default gen_random_uuid(),
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 quantity_before integer not null,
 change_quantity integer not null,
 quantity_after integer not null,
 note text,
 changed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists variant_stock_movements_created_idx on public.variant_stock_movements(variant_id,created_at desc);
create trigger product_variants_touch_updated_at before update on public.product_variants
 for each row execute function private.touch_updated_at();
create or replace function private.activate_parent_variants() returns trigger
 language plpgsql security definer set search_path='' as $function$
begin
 update public.products set has_variants=true where id=new.product_id and not has_variants;
 return new;
end;
$function$;
revoke all on function private.activate_parent_variants() from public,anon,authenticated;
create trigger product_variants_activate_parent after insert on public.product_variants
 for each row execute function private.activate_parent_variants();
create or replace function private.audit_variant_stock() returns trigger
 language plpgsql security definer set search_path='' as $function$
begin
 if old.stock_quantity is distinct from new.stock_quantity then
  insert into public.variant_stock_movements(
   variant_id,quantity_before,change_quantity,quantity_after,note,changed_by
  ) values(
   new.id,old.stock_quantity,new.stock_quantity-old.stock_quantity,new.stock_quantity,
   nullif(pg_catalog.current_setting('app.stock_note',true),''),
   (select auth.uid())
  );
 end if;
 return new;
end;
$function$;
revoke all on function private.audit_variant_stock() from public,anon,authenticated;
create trigger product_variants_stock_audit after update of stock_quantity on public.product_variants
 for each row execute function private.audit_variant_stock();
alter table public.product_variants enable row level security;
alter table public.variant_stock_movements enable row level security;
revoke all on public.product_variants,public.variant_stock_movements from public,anon,authenticated;
grant select on public.product_variants to anon,authenticated;
grant insert,update,delete on public.product_variants to authenticated;
grant select on public.variant_stock_movements to authenticated;
create policy "variant_public_or_admin_select" on public.product_variants for select to anon,authenticated
 using(
   (is_active and exists(select 1 from public.products p where p.id=product_id and p.is_active))
   or exists(select 1 from public.store_admins a where a.user_id=(select auth.uid()))
 );
create policy "variant_admin_insert" on public.product_variants for insert to authenticated
 with check(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy "variant_admin_update" on public.product_variants for update to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())))
 with check(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy "variant_admin_delete" on public.product_variants for delete to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy "variant_stock_admin_read" on public.variant_stock_movements for select to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
alter table public.order_request_items add column if not exists variant_id uuid references public.product_variants(id) on delete restrict;
alter table public.order_request_items add column if not exists variant_label text;
create unique index if not exists order_request_items_variant_unique
 on public.order_request_items(order_request_id,product_id,variant_id) nulls not distinct;
create or replace function public.adjust_variant_stock(p_variant_id uuid,p_change integer,p_note text default null)
returns integer language plpgsql security invoker set search_path='' as $function$
declare v_new_stock integer;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.store_admins a where a.user_id=(select auth.uid())
 ) then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_change=0 or abs(p_change)>100000 or char_length(coalesce(p_note,''))>250 then
  raise exception 'Geçersiz stok değişikliği.' using errcode='22023'; end if;
 perform pg_catalog.set_config('app.stock_note',coalesce(p_note,'Varyant stok düzenlemesi'),true);
 update public.product_variants set stock_quantity=stock_quantity+p_change
 where id=p_variant_id and stock_quantity+p_change>=0 returning stock_quantity into v_new_stock;
 if not found then raise exception 'Varyant bulunamadı veya stok yetersiz.' using errcode='22023'; end if;
 return v_new_stock;
end;
$function$;
revoke all on function public.adjust_variant_stock(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.adjust_variant_stock(uuid,integer,text) to authenticated;
