-- Öz Kırtasiye: manual order fulfillment, shipment metadata and safe stock restoration.
-- Existing completed orders are historical and remain terminal; they already had stock deducted.
-- This is NOT a PayTR refund or payment capture integration.

alter table public.order_requests
  drop constraint if exists order_requests_status_check;
alter table public.order_requests
  add constraint order_requests_status_check
  check (status in ('new','contacted','processing','shipped','delivered','completed','cancelled'));

alter table public.order_requests
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists inventory_deducted_at timestamptz,
  add column if not exists inventory_restored_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

-- Legacy 'completed' requests already reduced stock in the previous RPC.
update public.order_requests
  set inventory_deducted_at = coalesce(inventory_deducted_at, updated_at)
  where status = 'completed' and inventory_deducted_at is null;

create index if not exists order_requests_status_created_idx
  on public.order_requests (status, created_at desc);

create table if not exists public.order_request_status_history (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_request_history_order_created_idx
  on public.order_request_status_history(order_request_id, created_at asc);
alter table public.order_request_status_history enable row level security;
revoke all on public.order_request_status_history from public, anon, authenticated;
grant select, insert on public.order_request_status_history to authenticated;

create policy "order_request_history_admin_select"
  on public.order_request_status_history for select to authenticated
  using (exists (select 1 from public.store_admins a where a.user_id = (select auth.uid())));
create policy "order_request_history_admin_insert"
  on public.order_request_status_history for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and changed_by = (select auth.uid())
    and exists (select 1 from public.store_admins a where a.user_id = (select auth.uid()))
  );

-- Direct table UPDATE remains limited to authenticated store admins by RLS.
-- SECURITY INVOKER means this RPC cannot bypass those policies.
grant update on public.order_requests to authenticated;
create policy "order_requests_admin_update"
  on public.order_requests for update to authenticated
  using (exists (select 1 from public.store_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.store_admins a where a.user_id = (select auth.uid())));

-- Retire the former SECURITY DEFINER status RPC, which cannot handle the new stages.
revoke all on function public.update_order_request_status(uuid,text) from public, anon, authenticated;

create or replace function public.manage_order_request(
  p_order_id uuid,
  p_action text,
  p_carrier text default null,
  p_tracking_number text default null,
  p_reason text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_previous text;
  v_next text;
  v_item record;
  v_updated uuid;
  v_carrier text := nullif(pg_catalog.btrim(coalesce(p_carrier,'')), '');
  v_tracking text := nullif(pg_catalog.btrim(coalesce(p_tracking_number,'')), '');
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason,'')), '');
  v_note text;
  v_has_deduction boolean;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_admins where user_id = (select auth.uid())
  ) then
    raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501';
  end if;
  select status, inventory_deducted_at is not null
    into v_previous, v_has_deduction
    from public.order_requests where id = p_order_id for update;
  if not found then
    raise exception 'Sipariş talebi bulunamadı.' using errcode = '22023';
  end if;

  case p_action
    when 'contact' then
      if v_previous <> 'new' then raise exception 'Yalnızca yeni taleple görüşülebilir.' using errcode = '22023'; end if;
      v_next := 'contacted';
    when 'prepare' then
      if v_previous <> 'contacted' or v_has_deduction then
        raise exception 'Stok yalnızca görüşülen ve işleme alınmamış talepten düşülebilir.' using errcode = '22023';
      end if;
      v_next := 'processing';
    when 'ship' then
      if v_previous <> 'processing' then raise exception 'Yalnızca hazırlanan sipariş kargoya verilebilir.' using errcode = '22023'; end if;
      if v_carrier is null or pg_catalog.char_length(v_carrier) not between 2 and 60
        or v_tracking is null or v_tracking !~ '^[a-zA-Z0-9_-]{3,80}$'
      then raise exception 'Geçerli kargo firması ve takip numarası girin.' using errcode = '22023'; end if;
      v_next := 'shipped';
    when 'deliver' then
      if v_previous <> 'shipped' then raise exception 'Yalnızca kargodaki sipariş teslim edilebilir.' using errcode = '22023'; end if;
      v_next := 'delivered';
    when 'cancel' then
      if v_previous not in ('new','contacted','processing') then
        raise exception 'Kargoya verilen veya teslim edilen sipariş buradan iptal edilemez; iade süreci gerekir.' using errcode = '22023';
      end if;
      if v_previous = 'processing' and (v_reason is null or pg_catalog.char_length(v_reason) < 3) then
        raise exception 'Stok iadesi için iptal gerekçesini yazın.' using errcode = '22023';
      end if;
      if v_reason is not null and pg_catalog.char_length(v_reason) > 300 then
        raise exception 'İptal gerekçesi 300 karakteri geçemez.' using errcode = '22023';
      end if;
      v_next := 'cancelled';
    else
      raise exception 'Geçersiz sipariş işlemi.' using errcode = '22023';
  end case;

  -- Atomic reservation-by-deduction. If any item lacks stock, the whole transaction rolls back.
  if p_action = 'prepare' then
    perform pg_catalog.set_config('app.stock_note', 'Sipariş hazırlığa alındı: ' || p_order_id::text, true);
    for v_item in
      select product_id, quantity from public.order_request_items
      where order_request_id = p_order_id order by product_id
    loop
      update public.products p
      set stock_quantity = p.stock_quantity - v_item.quantity
      where p.id = v_item.product_id and p.stock_quantity >= v_item.quantity
      returning p.id into v_updated;
      if not found then raise exception 'Yetersiz stok: %', v_item.product_id using errcode = '22023'; end if;
    end loop;
    update public.order_requests
      set status = 'processing', inventory_deducted_at = now()
      where id = p_order_id;
  elsif p_action = 'cancel' and v_previous = 'processing' then
    if not v_has_deduction then raise exception 'Stok düşüm bilgisi bulunamadı.' using errcode = '22023'; end if;
    perform pg_catalog.set_config('app.stock_note', 'Sipariş iptalinden stok iadesi: ' || p_order_id::text, true);
    for v_item in
      select product_id, quantity from public.order_request_items
      where order_request_id = p_order_id order by product_id
    loop
      update public.products p set stock_quantity = p.stock_quantity + v_item.quantity
      where p.id = v_item.product_id
      returning p.id into v_updated;
      if not found then raise exception 'Stok iadesinde ürün bulunamadı: %',v_item.product_id using errcode = '22023'; end if;
    end loop;
    update public.order_requests
      set status = 'cancelled', inventory_restored_at = now(), cancelled_at = now(), cancellation_reason = v_reason
      where id = p_order_id;
  elsif p_action = 'cancel' then
    update public.order_requests
      set status = 'cancelled', cancelled_at = now(), cancellation_reason = v_reason
      where id = p_order_id;
  elsif p_action = 'ship' then
    update public.order_requests
      set status = 'shipped', carrier = v_carrier,
          tracking_number = v_tracking, shipped_at = now()
      where id = p_order_id;
  elsif p_action = 'deliver' then
    update public.order_requests
      set status = 'delivered', delivered_at = now()
      where id = p_order_id;
  else
    update public.order_requests set status = v_next where id = p_order_id;
  end if;

  v_note := case p_action
    when 'prepare' then 'Hazırlığa alındı; stok düşüldü.'
    when 'cancel' then case when v_previous = 'processing'
      then 'İptal edildi; stok iade edildi. ' || coalesce(v_reason,'')
      else 'Talep iptal edildi. ' || coalesce(v_reason,'') end
    when 'ship' then 'Kargo: ' || v_carrier || ' / ' || v_tracking
    when 'deliver' then 'Teslim edildi.'
    else 'Müşteriyle görüşüldü.' end;
  insert into public.order_request_status_history(order_request_id,from_status,to_status,note,changed_by)
  values(p_order_id, v_previous, v_next, v_note, (select auth.uid()));
  return v_next;
end;
$function$;

revoke all on function public.manage_order_request(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.manage_order_request(uuid,text,text,text,text) to authenticated;
