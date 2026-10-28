-- Aşama 29.1 — provider-agnostic payment reservation foundation.
-- No checkout endpoint, callback or live payment collection is enabled by this migration.
-- The existing manual request flow keeps payment_status='not_collected' and its stock semantics.

alter table public.order_requests
  drop constraint if exists order_requests_payment_status_check;
alter table public.order_requests
  add constraint order_requests_payment_status_check
  check (payment_status in (
    'not_collected', 'pending', 'paid', 'failed', 'expired', 'requires_review'
  ));

alter table public.order_requests
  drop constraint if exists order_requests_status_check;
alter table public.order_requests
  add constraint order_requests_status_check
  check (status in (
    'new', 'contacted', 'processing', 'shipped', 'delivered', 'completed',
    'cancelled', 'awaiting_payment', 'paid'
  ));

-- One payment attempt per immutable order snapshot. A failed attempt requires a
-- fresh checkout order (and idempotency key) rather than reusing old line prices.
create table private.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null unique references public.order_requests(id) on delete restrict,
  provider text not null default 'paytr' check (provider='paytr'),
  merchant_oid text not null unique check (merchant_oid ~ '^[A-Za-z0-9_-]{8,64}$'),
  amount_kurus bigint not null check (amount_kurus > 0),
  currency text not null default 'TRY' check (currency='TRY'),
  state text not null default 'pending'
    check (state in ('pending','succeeded','failed','expired','requires_review')),
  prior_order_status text not null check (prior_order_status in ('new','contacted')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  provider_reference text check (
    provider_reference is null or char_length(provider_reference) between 1 and 128
  ),
  constraint payment_expiry_after_reservation check(expires_at>reserved_at)
);

create index payment_attempts_expiring_idx
  on private.payment_attempts(expires_at, id) where state='pending';
create index payment_attempts_state_created_idx
  on private.payment_attempts(state,reserved_at desc);

-- Stock is physically deducted during reservation, so existing catalog, cart,
-- manual checkout and admin stock readers see only free quantities.
create table private.payment_reserved_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references private.payment_attempts(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity integer not null check(quantity between 1 and 99),
  unique nulls not distinct (payment_id, product_id, variant_id)
);
create index payment_reserved_items_payment_idx
  on private.payment_reserved_items(payment_id);

alter table private.payment_attempts enable row level security;
alter table private.payment_reserved_items enable row level security;
revoke all on private.payment_attempts,private.payment_reserved_items from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update on private.payment_attempts to service_role;
grant select,insert on private.payment_reserved_items to service_role;
grant select,update on public.order_requests,public.products,public.product_variants to service_role;
grant select on public.order_request_items to service_role;

-- Existing admin table privileges allow generic order updates. Prevent any
-- admin/browser from manufacturing an accepted payment or changing the order
-- under an active/paid reservation. Later admin payment actions must use
-- dedicated, authorized server-side functions.
create function private.guard_payment_order_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('service_role','postgres') then
    if old.payment_status is distinct from new.payment_status then
      raise exception 'Ödeme durumunu bu işlemle değiştiremezsiniz.' using errcode='42501';
    end if;
    if old.payment_status in ('pending','paid','requires_review')
      and pg_catalog.to_jsonb(new) - 'updated_at'
        is distinct from pg_catalog.to_jsonb(old) - 'updated_at' then
      raise exception 'Ödeme siparişi yalnızca yetkili ödeme akışından güncellenebilir.'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_payment_order_mutation() from public,anon,authenticated;
create trigger order_requests_guard_payment_mutation
before update on public.order_requests
for each row execute function private.guard_payment_order_mutation();

-- Only a server holding the Supabase secret key can begin the atomic hold.
-- Call it only after the existing server-verified checkout creates a fresh order.
create function public.begin_payment_reservation(
  p_order_id uuid, p_merchant_oid text, p_ttl_seconds integer default 900
)
returns table(payment_id uuid, amount_kurus bigint, expires_at timestamptz, payment_state text)
language plpgsql security invoker set search_path='' as $$
declare
  v_order public.order_requests%rowtype;
  v_previous private.payment_attempts%rowtype;
  v_payment_id uuid;
  v_expires timestamptz;
  v_item record;
  v_updated uuid;
  v_amount bigint;
begin
  if p_order_id is null or p_merchant_oid is null
    or p_merchant_oid !~ '^[A-Za-z0-9_-]{8,64}$'
    or p_ttl_seconds is null or p_ttl_seconds not between 300 and 1800 then
    raise exception 'Geçersiz ödeme rezervasyonu.' using errcode='22023';
  end if;

  -- All payment functions lock order first, payment attempt second, then stock.
  select * into v_order from public.order_requests
    where id=p_order_id for update;
  if not found then
    raise exception 'Sipariş bulunamadı.' using errcode='22023';
  end if;
  select * into v_previous from private.payment_attempts
    where order_request_id=p_order_id for update;
  if found then
    if v_previous.merchant_oid=p_merchant_oid and v_previous.state='pending'
      and v_previous.expires_at>now() then
      return query select v_previous.id,v_previous.amount_kurus,
        v_previous.expires_at,v_previous.state;
      return;
    end if;
    raise exception 'Bu sipariş için başka bir ödeme işlemi mevcut.'
      using errcode='22023';
  end if;

  if v_order.status not in ('new','contacted')
    or v_order.payment_status<>'not_collected'
    or v_order.inventory_deducted_at is not null
    or v_order.created_at<=now()-interval '15 minutes'
    or v_order.total<=0 then
    raise exception 'Sipariş yeni ödeme için uygun değil.' using errcode='22023';
  end if;
  v_amount:=pg_catalog.round(v_order.total*100)::bigint;
  v_expires:=now()+pg_catalog.make_interval(secs=>p_ttl_seconds);
  insert into private.payment_attempts (
    order_request_id,merchant_oid,amount_kurus,prior_order_status,reserved_at,expires_at
  ) values (v_order.id,p_merchant_oid,v_amount,v_order.status,now(),v_expires)
    returning id into v_payment_id;

  perform pg_catalog.set_config('app.stock_note','Ödeme için süreli stok rezervasyonu',true);
  for v_item in
    select product_id,variant_id,quantity from public.order_request_items
    where order_request_id=p_order_id order by product_id,variant_id nulls first
  loop
    if v_item.variant_id is null then
      update public.products p set stock_quantity=p.stock_quantity-v_item.quantity
        where p.id=v_item.product_id and p.is_active and not p.has_variants
          and p.stock_quantity>=v_item.quantity returning p.id into v_updated;
    else
      update public.product_variants pv set stock_quantity=pv.stock_quantity-v_item.quantity
        where pv.id=v_item.variant_id and pv.product_id=v_item.product_id
          and pv.is_active and pv.stock_quantity>=v_item.quantity
          and exists(select 1 from public.products p
             where p.id=pv.product_id and p.is_active and p.has_variants)
        returning pv.id into v_updated;
    end if;
    if not found then
      raise exception 'Ödeme için stok yetersiz veya ürün artık satışta değil.'
        using errcode='22023';
    end if;
    insert into private.payment_reserved_items(payment_id,product_id,variant_id,quantity)
      values(v_payment_id,v_item.product_id,v_item.variant_id,v_item.quantity);
  end loop;
  if not found then
    raise exception 'Boş sipariş rezerve edilemez.' using errcode='22023';
  end if;

  update public.order_requests set status='awaiting_payment',payment_status='pending',
    inventory_deducted_at=now() where id=p_order_id;
  return query select v_payment_id,v_amount,v_expires,'pending'::text;
end;
$$;

-- This helper must only run after caller has locked order and payment rows.
create function private.release_payment_reservation(p_payment_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_attempt private.payment_attempts%rowtype;
  v_line record;
  v_updated uuid;
begin
  if p_reason not in ('failed','expired') then
    raise exception 'Geçersiz rezervasyon sonlandırma durumu.' using errcode='22023';
  end if;
  select * into v_attempt from private.payment_attempts where id=p_payment_id;
  if not found or v_attempt.state<>'pending' then
    raise exception 'Aktif rezervasyon bulunamadı.' using errcode='22023';
  end if;
  perform pg_catalog.set_config('app.stock_note','Ödeme rezervasyonu serbest bırakıldı',true);
  for v_line in
    select product_id,variant_id,quantity from private.payment_reserved_items
    where payment_id=p_payment_id order by product_id,variant_id nulls first
  loop
    if v_line.variant_id is null then
      update public.products p set stock_quantity=p.stock_quantity+v_line.quantity
        where p.id=v_line.product_id and p.stock_quantity<=2147483647-v_line.quantity
        returning p.id into v_updated;
    else
      update public.product_variants pv set stock_quantity=pv.stock_quantity+v_line.quantity
        where pv.id=v_line.variant_id and pv.product_id=v_line.product_id
          and pv.stock_quantity<=2147483647-v_line.quantity
        returning pv.id into v_updated;
    end if;
    if not found then
      raise exception 'Rezerve stok iadesi başarısız.' using errcode='22023';
    end if;
  end loop;

  update private.payment_attempts set state=p_reason,finalized_at=now()
    where id=p_payment_id;
  update public.order_requests set status='cancelled',payment_status=p_reason,
    inventory_restored_at=now(),cancelled_at=now(),
    cancellation_reason=case when p_reason='expired'
      then 'Ödeme süresi doldu.' else 'Ödeme başarısız.' end
    where id=v_attempt.order_request_id
      and status='awaiting_payment' and payment_status='pending';
  if not found then
    raise exception 'Ödeme siparişi başka bir işleme geçmiş.' using errcode='22023';
  end if;
end;
$$;

-- Only after a future PayTR callback has been cryptographically verified in
-- the server API (29.2) may its outcome be passed to this function.
create function public.finish_payment_reservation(
  p_merchant_oid text, p_outcome text, p_provider_reference text default null
)
returns text language plpgsql security invoker set search_path='' as $$
declare
  v_attempt private.payment_attempts%rowtype;
  v_order_id uuid;
  v_payment_id uuid;
begin
  if p_merchant_oid is null or p_merchant_oid !~ '^[A-Za-z0-9_-]{8,64}$'
    or p_outcome not in ('succeeded','failed')
    or (p_provider_reference is not null
      and pg_catalog.char_length(p_provider_reference) not between 1 and 128) then
    raise exception 'Geçersiz ödeme bildirimi.' using errcode='22023';
  end if;
  select id,order_request_id into v_payment_id,v_order_id
    from private.payment_attempts where merchant_oid=p_merchant_oid;
  if not found then
    raise exception 'Ödeme kaydı bulunamadı.' using errcode='22023';
  end if;
  perform 1 from public.order_requests where id=v_order_id for update;
  select * into v_attempt from private.payment_attempts
    where id=v_payment_id for update;

  if v_attempt.state='pending' then
    if v_attempt.expires_at<=now() then
      perform private.release_payment_reservation(v_attempt.id,'expired');
      if p_outcome='succeeded' then
        -- Money may have arrived after stock was released. Never silently
        -- allocate again; 29.4 must investigate/refund the late payment.
        update private.payment_attempts set state='requires_review',
          provider_reference=p_provider_reference where id=v_attempt.id;
        update public.order_requests set payment_status='requires_review'
          where id=v_order_id;
        return 'requires_review';
      end if;
      return 'expired';
    end if;
    if p_outcome='failed' then
      perform private.release_payment_reservation(v_attempt.id,'failed');
      return 'failed';
    end if;
    update private.payment_attempts set state='succeeded',finalized_at=now(),
      provider_reference=p_provider_reference where id=v_attempt.id;
    update public.order_requests set status='paid',payment_status='paid'
      where id=v_order_id and status='awaiting_payment' and payment_status='pending';
    if not found then
      raise exception 'Ödeme siparişinin durumu değişmiş.' using errcode='22023';
    end if;
    return 'succeeded';
  end if;

  if v_attempt.state in ('failed','expired') and p_outcome='succeeded' then
    update private.payment_attempts set state='requires_review',
      provider_reference=p_provider_reference where id=v_attempt.id;
    update public.order_requests set payment_status='requires_review'
      where id=v_order_id and status='cancelled';
    if not found then
      raise exception 'İncelenecek sipariş bulunamadı.' using errcode='22023';
    end if;
    return 'requires_review';
  end if;
  -- Duplicate callbacks (including an out-of-order failure after a success)
  -- must never deduct/release inventory twice or change an accepted payment.
  return v_attempt.state;
end;
$$;

-- The cleanup entry point is deliberately service-only and bounded.
-- 29.2 must schedule it; expiry is not a background job yet.
create function public.expire_payment_reservations(p_limit integer default 100)
returns integer language plpgsql security invoker set search_path='' as $$
declare
  v_candidate record;
  v_state text;
  v_expiry timestamptz;
  v_expired integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 200 then
    raise exception 'Geçersiz temizleme limiti.' using errcode='22023';
  end if;
  for v_candidate in
    select id,order_request_id from private.payment_attempts
    where state='pending' and expires_at<=now()
    order by expires_at,id limit p_limit
  loop
    perform 1 from public.order_requests where id=v_candidate.order_request_id for update;
    select state,expires_at into v_state,v_expiry
      from private.payment_attempts where id=v_candidate.id for update;
    if v_state='pending' and v_expiry<=now() then
      perform private.release_payment_reservation(v_candidate.id,'expired');
      v_expired:=v_expired+1;
    end if;
  end loop;
  return v_expired;
end;
$$;

revoke all on function private.release_payment_reservation(uuid,text) from public,anon,authenticated;
grant execute on function private.release_payment_reservation(uuid,text) to service_role;
revoke all on function public.begin_payment_reservation(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.finish_payment_reservation(text,text,text) from public,anon,authenticated;
revoke all on function public.expire_payment_reservations(integer) from public,anon,authenticated;
grant execute on function public.begin_payment_reservation(uuid,text,integer),
  public.finish_payment_reservation(text,text,text),
  public.expire_payment_reservations(integer) to service_role;
