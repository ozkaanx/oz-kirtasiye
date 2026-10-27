-- Service-only ledgers. Neither raw request bodies nor IP addresses are stored.
create table private.order_request_submissions (
 request_key uuid primary key,
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 customer_user_id uuid references auth.users(id) on delete set null,
 order_request_id uuid not null unique references public.order_requests(id) on delete restrict,
 result jsonb not null check(jsonb_typeof(result)='object'),
 created_at timestamptz not null default now()
);
create table private.order_request_rate_limits (
 key text primary key,
 window_started_at timestamptz not null,
 hits integer not null check(hits>0)
);
create index order_request_submissions_customer_idx on private.order_request_submissions(customer_user_id);
create index order_request_rate_limits_window_idx on private.order_request_rate_limits(window_started_at);
alter table private.order_request_submissions enable row level security;
alter table private.order_request_rate_limits enable row level security;
revoke all on private.order_request_submissions,private.order_request_rate_limits from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert on private.order_request_submissions to service_role;
grant select,insert,update,delete on private.order_request_rate_limits to service_role;

-- A single atomic upsert serializes concurrent calls across server instances.
create function private.consume_order_limit(p_key text,p_limit integer)
returns table(allowed boolean,retry_after integer)
language plpgsql security invoker set search_path='' as $$
declare v_window timestamptz; v_hits integer;
begin
 insert into private.order_request_rate_limits as b(key,window_started_at,hits)
 values(p_key,now(),1)
 on conflict(key) do update set
  window_started_at=case when b.window_started_at<=now()-interval '1 minute' then now() else b.window_started_at end,
  hits=case when b.window_started_at<=now()-interval '1 minute' then 1 else least(b.hits+1,p_limit+1) end
 returning window_started_at,hits into v_window,v_hits;
 return query select v_hits<=p_limit,
  case when v_hits<=p_limit then 0 else greatest(1,ceil(extract(epoch from v_window+interval '1 minute'-now()))::integer) end;
end;
$$;
revoke all on function private.consume_order_limit(text,integer) from public,anon,authenticated;
grant execute on function private.consume_order_limit(text,integer) to service_role;

create function public.consume_order_request_limits(p_actor_key text,p_ip_key text default null)
returns table(allowed boolean,retry_after integer)
language plpgsql security invoker set search_path='' as $$
declare v_result record;
begin
 if p_actor_key is null or p_actor_key !~ '^[0-9a-f]{64}$'
  or (p_ip_key is not null and p_ip_key !~ '^[0-9a-f]{64}$') then
  raise exception 'Geçersiz istek kimliği.' using errcode='22023';
 end if;
 -- Bounded opportunistic cleanup: no cron or growing list of expired keys.
 delete from private.order_request_rate_limits where key in (
  select b.key from private.order_request_rate_limits b
  where b.window_started_at<now()-interval '1 hour' order by b.window_started_at limit 100
 );
 select * into v_result from private.consume_order_limit('global',200);
 if not v_result.allowed then return query select false,v_result.retry_after; return; end if;
 select * into v_result from private.consume_order_limit('actor:'||p_actor_key,20);
 if not v_result.allowed then return query select false,v_result.retry_after; return; end if;
 if p_ip_key is not null then
  select * into v_result from private.consume_order_limit('ip:'||p_ip_key,40);
  if not v_result.allowed then return query select false,v_result.retry_after; return; end if;
 end if;
 return query select true,0;
end;
$$;
revoke all on function public.consume_order_request_limits(text,text) from public,anon,authenticated;
grant execute on function public.consume_order_request_limits(text,text) to service_role;

-- Request identity/hash are constructed by the verified Next.js API, never by a public RPC caller.
-- This transaction writes both the order and its original response, or neither.
create function public.submit_order_request_idempotent(
 p_request_key uuid,p_request_hash text,p_payload jsonb,p_customer_user_id uuid default null
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,
 delivery_method text,discount_amount numeric,code text,campaign_name text,replayed boolean)
language plpgsql security invoker set search_path='' as $$
declare v_previous private.order_request_submissions%rowtype; v_result jsonb; v_replayed boolean:=false;
begin
 if p_request_key is null or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
  or p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise exception 'Geçersiz sipariş isteği.' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_key::text,716233));
 select * into v_previous from private.order_request_submissions s where s.request_key=p_request_key;
 if found then
  if v_previous.request_hash<>p_request_hash or v_previous.customer_user_id is distinct from p_customer_user_id then
   raise exception 'Bu işlem anahtarı farklı bir talepte kullanılmış. Siparişlerini kontrol et.' using errcode='PT409';
  end if;
  v_result:=v_previous.result;
  v_replayed:=true;
 else
  select to_jsonb(r) into v_result from public.submit_order_request_with_auto_discounts(
   p_payload->>'customerName',p_payload->>'phone',p_payload->>'city',p_payload->>'district',
   p_payload->>'address',p_payload->>'note',p_payload->'items',
   (p_payload->>'preInformationRead')::boolean,(p_payload->>'privacyNoticeRead')::boolean,
   p_payload->>'noticeVersion',p_payload->>'deliveryMethod',p_customer_user_id,
   p_payload->'billing',p_payload->>'couponCode'
  ) r;
  if v_result is null then raise exception 'Talep kaydedilemedi.' using errcode='22023'; end if;
  insert into private.order_request_submissions(request_key,request_hash,customer_user_id,order_request_id,result)
  values(p_request_key,p_request_hash,p_customer_user_id,(v_result->>'id')::uuid,v_result);
 end if;
 return query select r.id,r.reference,r.subtotal,r.shipping_fee,r.total,r.delivery_method,
  r.discount_amount,r.code,r.campaign_name,v_replayed
 from jsonb_to_record(v_result) as r(id uuid,reference text,subtotal numeric,shipping_fee numeric,
  total numeric,delivery_method text,discount_amount numeric,code text,campaign_name text);
end;
$$;
revoke all on function public.submit_order_request_idempotent(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.submit_order_request_idempotent(uuid,text,jsonb,uuid) to service_role;
