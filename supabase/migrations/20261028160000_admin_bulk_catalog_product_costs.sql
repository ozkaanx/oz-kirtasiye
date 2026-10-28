-- Aşama 32: keep business purchase costs separate from the publicly readable
-- products table. No public customer can read this table through the Data API.
create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_price numeric(12,2) not null check (cost_price >= 0 and cost_price <= 9999999999.99),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
revoke all on public.product_costs from public, anon, authenticated;
grant select, insert, update on public.product_costs to authenticated;

create policy product_costs_admin_read on public.product_costs
for select to authenticated using (
  exists (select 1 from public.store_admins a where a.user_id = (select auth.uid()))
);
create policy product_costs_admin_insert on public.product_costs
for insert to authenticated with check (
  exists (select 1 from public.store_admins a where a.user_id = (select auth.uid()))
);
create policy product_costs_admin_update on public.product_costs
for update to authenticated
using (exists (select 1 from public.store_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.store_admins a where a.user_id = (select auth.uid())));

create index products_admin_sku_ci_idx on public.products ((upper(btrim(sku))))
where sku is not null;

-- A single RPC transaction handles both dry-run and confirmed batches. Inputs
-- are validated AGAIN inside Postgres; the browser's preview is never trusted.
-- Existing variant-product stock and prices must be edited in the variant UI.
create function public.admin_bulk_import_products(
  p_rows jsonb,
  p_commit boolean default false,
  p_allow_stock_updates boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_sku text;
  v_name text;
  v_category_slug text;
  v_category uuid;
  v_existing public.products%rowtype;
  v_existing_count integer;
  v_product_id uuid;
  v_slug text;
  v_created integer := 0;
  v_updated integer := 0;
  v_preview jsonb := '[]'::jsonb;
  v_seen text[] := '{}'::text[];
  v_price numeric(12,2);
  v_cost numeric(12,2);
  v_stock integer;
  v_threshold integer;
  v_index integer := 0;
  v_allowed text[] := array[
    'sku','name','price','cost_price','stock_quantity',
    'low_stock_threshold','category_slug','is_active','description','slug'
  ];
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_admins a where a.user_id = (select auth.uid())
  ) then
    raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) not between 1 and 200
     or p_commit is null or p_allow_stock_updates is null then
    raise exception 'Aktarım 1–200 satırlık bir liste olmalıdır.' using errcode = '22023';
  end if;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    if jsonb_typeof(v_row) <> 'object'
       or exists (
         select 1 from pg_catalog.jsonb_object_keys(v_row) as k(key)
         where k.key <> all(v_allowed)
       ) then
      raise exception 'Satır %: Desteklenmeyen alan var.',v_index using errcode='22023';
    end if;

    v_sku := upper(btrim(v_row->>'sku'));
    if v_sku is null or v_sku !~ '^[A-Z0-9_-]{2,64}$'
       or v_sku = any(v_seen) then
      raise exception 'Satır %: Geçersiz veya tekrar eden SKU.',v_index using errcode='22023';
    end if;
    v_seen := array_append(v_seen,v_sku);
    if not (v_row ? 'slug') or v_row->>'slug' !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
       or char_length(v_row->>'slug') > 180 then
      raise exception 'Satır %: Güvenli ürün URL değeri gerekli.',v_index using errcode='22023';
    end if;
    if v_row ? 'name' and (
      jsonb_typeof(v_row->'name') <> 'string' or
      char_length(btrim(v_row->>'name')) not between 2 and 200
    ) then
      raise exception 'Satır %: Ürün adı 2–200 karakter olmalı.',v_index using errcode='22023';
    end if;
    if v_row ? 'description' and (
      jsonb_typeof(v_row->'description') <> 'string' or
      char_length(v_row->>'description') > 3000
    ) then
      raise exception 'Satır %: Açıklama 3000 karakteri aşamaz.',v_index using errcode='22023';
    end if;
    if v_row ? 'price' and (
      jsonb_typeof(v_row->'price') <> 'number' or
      (v_row->>'price')::numeric < 0 or
      (v_row->>'price')::numeric > 9999999999.99 or
      (v_row->>'price')::numeric <> round((v_row->>'price')::numeric,2)
    ) then
      raise exception 'Satır %: Satış fiyatı geçersiz.',v_index using errcode='22023';
    end if;
    if v_row ? 'cost_price' and (
      jsonb_typeof(v_row->'cost_price') <> 'number' or
      (v_row->>'cost_price')::numeric < 0 or
      (v_row->>'cost_price')::numeric > 9999999999.99 or
      (v_row->>'cost_price')::numeric <> round((v_row->>'cost_price')::numeric,2)
    ) then
      raise exception 'Satır %: Alış maliyeti geçersiz.',v_index using errcode='22023';
    end if;
    if v_row ? 'stock_quantity' and (
      jsonb_typeof(v_row->'stock_quantity') <> 'number' or
      (v_row->>'stock_quantity')::numeric < 0 or
      (v_row->>'stock_quantity')::numeric > 2147483647 or
      (v_row->>'stock_quantity')::numeric <> trunc((v_row->>'stock_quantity')::numeric)
    ) then
      raise exception 'Satır %: Stok tam sayı olmalı.',v_index using errcode='22023';
    end if;
    if v_row ? 'low_stock_threshold' and (
      jsonb_typeof(v_row->'low_stock_threshold') <> 'number' or
      (v_row->>'low_stock_threshold')::numeric < 0 or
      (v_row->>'low_stock_threshold')::numeric > 2147483647 or
      (v_row->>'low_stock_threshold')::numeric <> trunc((v_row->>'low_stock_threshold')::numeric)
    ) then
      raise exception 'Satır %: Stok uyarı sınırı geçersiz.',v_index using errcode='22023';
    end if;
    if v_row ? 'is_active' and jsonb_typeof(v_row->'is_active') <> 'boolean' then
      raise exception 'Satır %: Yayın durumu doğru/yanlış olmalı.',v_index using errcode='22023';
    end if;
    if v_row ? 'category_slug' and (
      jsonb_typeof(v_row->'category_slug') <> 'string' or
      char_length(v_row->>'category_slug') not between 1 and 180
    ) then
      raise exception 'Satır %: Kategori kodu geçersiz.',v_index using errcode='22023';
    end if;

    v_category := null;
    if v_row ? 'category_slug' then
      v_category_slug := v_row->>'category_slug';
      select c.id into v_category from public.categories c where c.slug = v_category_slug;
      if v_category is null then
        raise exception 'Satır %: Kategori bulunamadı: %',v_index,v_category_slug using errcode='22023';
      end if;
    end if;
    -- Case-insensitive matching also supports products whose old SKU casing
    -- differs. Ambiguous old duplicates must fail rather than pick a product.
    select count(*), (array_agg(p.id))[1] into v_existing_count,v_product_id
      from public.products p where upper(btrim(p.sku))=v_sku;
    if v_existing_count > 1 then
      raise exception 'Satır %: Mevcut SKU birden fazla ürüne karşılık geliyor.',v_index
      using errcode='22023';
    end if;

    if v_existing_count = 0 then
      if not (v_row ? 'name') or not (v_row ? 'price') then
        raise exception 'Satır %: Yeni ürün için ad ve satış fiyatı zorunlu.',v_index
        using errcode='22023';
      end if;
      v_slug := v_row->>'slug';
      if exists (select 1 from public.products p where p.slug=v_slug) then
        raise exception 'Satır %: Oluşturulacak ürünün URL adresi zaten kullanılıyor.',v_index
        using errcode='23505';
      end if;
      if p_commit then
        insert into public.products (
          sku,name,slug,description,category_id,price,stock_quantity,
          low_stock_threshold,is_active,is_featured
        ) values (
          v_sku,btrim(v_row->>'name'),v_slug,v_row->>'description',v_category,
          (v_row->>'price')::numeric,
          coalesce((v_row->>'stock_quantity')::integer,0),
          coalesce((v_row->>'low_stock_threshold')::integer,5),
          coalesce((v_row->>'is_active')::boolean,false),false
        ) returning id into v_product_id;
      end if;
      v_created := v_created + 1;
      v_preview := v_preview || jsonb_build_array(jsonb_build_object(
        'sku',v_sku,'action','create','row',v_index
      ));
    else
      select * into v_existing from public.products where id=v_product_id
        for update;
      if v_existing.has_variants then
        raise exception 'Satır %: Varyantlı ürünler toplu aktarılamaz; varyant ekranını kullanın.',v_index
          using errcode='22023';
      end if;
      if v_row ? 'stock_quantity' and not p_allow_stock_updates then
        raise exception 'Satır %: Mevcut stok için "Stokları güncelle" onayı gerekli.',v_index
          using errcode='22023';
      end if;
      if p_commit then
        perform pg_catalog.set_config(
          'app.stock_note','Toplu CSV/Excel ürün güncellemesi ('||v_sku||')',true
        );
        update public.products p set
          name=case when v_row ? 'name' then btrim(v_row->>'name') else p.name end,
          description=case when v_row ? 'description' then v_row->>'description' else p.description end,
          category_id=case when v_row ? 'category_slug' then v_category else p.category_id end,
          price=case when v_row ? 'price' then (v_row->>'price')::numeric else p.price end,
          stock_quantity=case when v_row ? 'stock_quantity'
             then (v_row->>'stock_quantity')::integer else p.stock_quantity end,
          low_stock_threshold=case when v_row ? 'low_stock_threshold'
             then (v_row->>'low_stock_threshold')::integer else p.low_stock_threshold end,
          is_active=case when v_row ? 'is_active'
             then (v_row->>'is_active')::boolean else p.is_active end
        where p.id = v_product_id;
      end if;
      v_updated := v_updated + 1;
      v_preview := v_preview || jsonb_build_array(jsonb_build_object(
        'sku',v_sku,'action','update','row',v_index
      ));
    end if;

    if p_commit and v_row ? 'cost_price' then
      insert into public.product_costs (product_id,cost_price,updated_by,updated_at)
        values (v_product_id,(v_row->>'cost_price')::numeric,(select auth.uid()),now())
      on conflict (product_id) do update
        set cost_price=excluded.cost_price,updated_by=excluded.updated_by,updated_at=now();
    end if;
  end loop;

  return jsonb_build_object('created',v_created,'updated',v_updated,'rows',v_preview);
end;
$$;

revoke all on function public.admin_bulk_import_products(jsonb,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_bulk_import_products(jsonb,boolean,boolean)
  to authenticated;
