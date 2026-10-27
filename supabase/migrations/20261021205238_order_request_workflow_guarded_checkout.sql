-- Recovered from the hosted migration ledger; original version retained.

create table if not exists public.order_requests (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique,
 customer_name text not null check (char_length(customer_name) between 3 and 100),
 phone text not null check (char_length(phone) between 10 and 20),
 city text not null check (char_length(city) between 2 and 80),
 district text not null check (char_length(district) between 2 and 80),
 address text not null check (char_length(address) between 10 and 500),
 note text check (note is null or char_length(note) <= 500),
 status text not null default 'new' check (status in ('new','contacted','completed','cancelled')),
 payment_status text not null default 'not_collected' check (payment_status = 'not_collected'),
 subtotal numeric(12,2) not null check (subtotal >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.order_request_items (
 id uuid primary key default gen_random_uuid(),
 order_request_id uuid not null references public.order_requests(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict,
 product_name text not null,
 unit_price numeric(12,2) not null check (unit_price >= 0),
 quantity integer not null check (quantity between 1 and 99),
 line_total numeric(12,2) not null check (line_total = unit_price * quantity),
 unique(order_request_id, product_id)
);
create index if not exists order_requests_created_at_idx on public.order_requests(created_at desc);
create index if not exists order_requests_phone_created_idx on public.order_requests(phone, created_at desc);
create index if not exists order_request_items_order_idx on public.order_request_items(order_request_id);
create trigger order_requests_touch_updated_at before update on public.order_requests for each row execute function private.touch_updated_at();
alter table public.order_requests enable row level security;
alter table public.order_request_items enable row level security;
revoke all on public.order_requests from public, anon, authenticated;
revoke all on public.order_request_items from public, anon, authenticated;
grant select on public.order_requests, public.order_request_items to authenticated;
create policy "order_requests_admin_read" on public.order_requests for select to authenticated
using (exists(select 1 from public.store_admins a where a.user_id = (select auth.uid())));
create policy "order_request_items_admin_read" on public.order_request_items for select to authenticated
using (exists(select 1 from public.store_admins a where a.user_id = (select auth.uid())));
create or replace function public.submit_order_request(
 p_customer_name text, p_phone text, p_city text, p_district text,
 p_address text, p_note text, p_items jsonb
)
returns table (id uuid, reference text, subtotal numeric)
language plpgsql security definer set search_path = ''
as $function$
declare
 v_name text := trim(coalesce(p_customer_name,''));
 v_phone text := trim(coalesce(p_phone,''));
 v_city text := trim(coalesce(p_city,''));
 v_district text := trim(coalesce(p_district,''));
 v_address text := trim(coalesce(p_address,''));
 v_note text := nullif(trim(coalesce(p_note,'')),'');
 v_new_id uuid := gen_random_uuid();
 v_reference text := 'OZ-' || upper(substr(replace(v_new_id::text, '-', ''), 1, 12));
 v_subtotal numeric(12,2) := 0;
 v_row jsonb;
 v_product_id uuid;
 v_quantity integer;
 v_price numeric(12,2);
 v_product_name text;
 v_stock integer;
 v_seen uuid[] := '{}';
begin
 if char_length(v_name) not between 3 and 100
  or char_length(v_city) not between 2 and 80
  or char_length(v_district) not between 2 and 80
  or char_length(v_address) not between 10 and 500
  or char_length(coalesce(v_note,'')) > 500
  or v_phone !~ '^[+0-9 ()-]{10,20}$'
  or char_length(pg_catalog.regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 10 and 13
 then raise exception 'Teslimat bilgileri geçersiz.' using errcode = '22023'; end if;
 if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 20
 then raise exception 'Sepet geçersiz.' using errcode = '22023'; end if;
 v_phone := pg_catalog.regexp_replace(v_phone, '[^0-9]', '', 'g');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 2099));
 if (select count(*) from public.order_requests
     where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
  raise exception 'Çok fazla talep gönderildi. Daha sonra tekrar deneyin.' using errcode = '22023';
 end if;
 for v_row in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_row) <> 'object'
   or coalesce(v_row->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or coalesce(v_row->>'quantity','') !~ '^[1-9][0-9]?$'
  then raise exception 'Sepette geçersiz ürün var.' using errcode = '22023'; end if;
  v_product_id := (v_row->>'productId')::uuid;
  v_quantity := (v_row->>'quantity')::integer;
  if v_product_id = any(v_seen) then
   raise exception 'Yinelenen ürün satırı.' using errcode = '22023';
  end if;
  v_seen := array_append(v_seen,v_product_id);
  select p.name, p.price, p.stock_quantity
   into v_product_name, v_price, v_stock
   from public.products p
   where p.id = v_product_id and p.is_active = true;
  if not found or v_stock < v_quantity then
   raise exception 'Bir ürün stokta yok veya istenen miktar mevcut değil.' using errcode = '22023';
  end if;
  v_subtotal := v_subtotal + v_price * v_quantity;
  if v_subtotal > 999999.99 then
   raise exception 'Sepet tutarı üst sınırı aşıyor.' using errcode = '22023';
  end if;
 end loop;
 insert into public.order_requests (
  id,reference,customer_name,phone,city,district,address,note,subtotal
 ) values (
  v_new_id,v_reference,v_name,v_phone,v_city,v_district,v_address,v_note,v_subtotal
 );
 for v_row in select value from jsonb_array_elements(p_items) loop
  v_product_id := (v_row->>'productId')::uuid;
  v_quantity := (v_row->>'quantity')::integer;
  select p.name,p.price into v_product_name,v_price from public.products p where p.id=v_product_id;
  insert into public.order_request_items(order_request_id,product_id,product_name,unit_price,quantity,line_total)
  values(v_new_id,v_product_id,v_product_name,v_price,v_quantity,v_price*v_quantity);
 end loop;
 return query select v_new_id,v_reference,v_subtotal;
end;
$function$;
create or replace function public.update_order_request_status(p_order_id uuid,p_status text)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_previous text; v_item record; v_updated uuid;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.store_admins where user_id=(select auth.uid())
 ) then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_status not in ('contacted','cancelled','completed') then
  raise exception 'Geçersiz durum.' using errcode='22023';
 end if;
 select status into v_previous from public.order_requests where id=p_order_id for update;
 if not found then raise exception 'Sipariş talebi bulunamadı.' using errcode='22023'; end if;
 if v_previous = p_status then return p_status; end if;
 if v_previous in ('completed','cancelled')
    or (v_previous = 'new' and p_status = 'completed') then
  raise exception 'Bu durum geçişi yapılamaz.' using errcode='22023';
 end if;
 if p_status='completed' then
  perform pg_catalog.set_config('app.stock_note', 'Tamamlanan sipariş talebi ' || p_order_id::text, true);
  for v_item in select product_id,quantity from public.order_request_items
   where order_request_id=p_order_id order by product_id
  loop
   update public.products p set stock_quantity=stock_quantity-v_item.quantity
   where p.id=v_item.product_id and p.stock_quantity>=v_item.quantity
   returning p.id into v_updated;
   if not found then
    raise exception 'Yetersiz stok: %',v_item.product_id using errcode='22023';
   end if;
  end loop;
 end if;
 update public.order_requests set status=p_status where id=p_order_id;
 return p_status;
end;
$function$;
revoke all on function public.submit_order_request(text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.submit_order_request(text,text,text,text,text,text,jsonb) to service_role;
revoke all on function public.update_order_request_status(uuid,text) from public, anon, authenticated;
grant execute on function public.update_order_request_status(uuid,text) to authenticated;
