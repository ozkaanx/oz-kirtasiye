-- Disabled until provider credentials and the scheduled worker are verified.
create table private.order_email_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 enabled_at timestamptz
);
insert into private.order_email_settings(id) values(true);
alter table private.order_email_settings enable row level security;
revoke all on private.order_email_settings from public,anon,authenticated;

create table private.order_email_outbox (
 id uuid primary key default gen_random_uuid(),
 order_id uuid references public.order_requests(id) on delete cascade,
 is_test boolean not null default false,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null check(event_type in ('order_created','order_shipped')),
 message jsonb not null,
 state text not null default 'pending' check(state in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 first_attempt_at timestamptz, lease_until timestamptz, lease_token uuid,
 provider_id text, last_error text, created_at timestamptz not null default now(), sent_at timestamptz,
 unique(order_id,event_type),
 check(order_id is not null or is_test)
);
create index order_email_due_idx on private.order_email_outbox(available_at,created_at)
 where state in ('pending','processing');
alter table private.order_email_outbox enable row level security;
revoke all on private.order_email_outbox from public,anon,authenticated;

create function private.enqueue_order_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_email text; v_event text; v_subject text; v_text text;
begin
 if not exists(select 1 from private.order_email_settings where enabled) then return new; end if;
 if new.customer_user_id is null then return new; end if;
 if tg_op='INSERT' then
   if new.payment_status not in ('not_collected','paid') then return new; end if;
   v_event:='order_created';
 elsif new.status='shipped' and old.status is distinct from new.status then
   v_event:='order_shipped';
 elsif new.payment_status='paid' and old.payment_status is distinct from new.payment_status then
   v_event:='order_created';
 else return new;
 end if;
 select email into v_email from auth.users where id=new.customer_user_id and email_confirmed_at is not null;
 if v_email is null then return new; end if;
 if v_event='order_created' then
   v_subject:='Siparişiniz alındı · '||new.reference;
   v_text:='Merhaba,'||E'\n\n'||new.reference||' numaralı sipariş kaydınız oluşturuldu.'||E'\n'
    ||'Toplam tutar: '||to_char(new.total,'FM9999999990.00')||' TL.'||E'\n\n'
    ||'Siparişinizin güncel durumunu hesabınızdan takip edebilirsiniz.';
 else
   v_subject:='Siparişiniz kargoya verildi · '||new.reference;
   v_text:='Merhaba,'||E'\n\n'||new.reference||' numaralı siparişiniz kargoya verildi.'||E'\n'
    ||'Kargo firması: '||coalesce(new.carrier,'Belirtilmedi')||E'\n'
    ||'Takip numarası: '||coalesce(new.tracking_number,'Belirtilmedi');
 end if;
 -- Freeze the full provider payload: retries must never change idempotent content.
 insert into private.order_email_outbox(order_id,user_id,event_type,message)
 values(new.id,new.customer_user_id,v_event,jsonb_build_object(
   'from','Öz Kırtasiye <hesap@ozkirtasiye.net>','to',jsonb_build_array(v_email),
   'subject',v_subject,'text',v_text||E'\n\nhttps://ozkirtasiye.net/hesabim\n\nÖz Kırtasiye'
 )) on conflict(order_id,event_type) do nothing;
 return new;
end; $$;
revoke all on function private.enqueue_order_email() from public,anon,authenticated;
create trigger enqueue_order_email after insert or update of status,payment_status on public.order_requests
 for each row execute function private.enqueue_order_email();

create function public.claim_order_emails() returns table(id uuid,lease_token uuid,message jsonb)
language plpgsql security definer set search_path='' as $$
declare v_enabled boolean;
begin
 select enabled into v_enabled from private.order_email_settings where id;
 -- Retain the deduplication ledger, but discard old terminal message content.
 update private.order_email_outbox q set message='{}'::jsonb
 where q.state in ('sent','failed','cancelled') and q.created_at<now()-interval '30 days' and q.message<>'{}'::jsonb;
 -- Resend only retains idempotency keys for 24h. Ambiguous old sends need review, never blind replay.
 update private.order_email_outbox set state='failed',last_error='retry_window_expired'
 where state in ('pending','processing') and coalesce(first_attempt_at,created_at) < now()-interval '23 hours'
   and (lease_until is null or lease_until<now());
 update private.order_email_outbox set state='failed',last_error='retry_limit'
 where state in ('pending','processing') and attempts>=6 and (lease_until is null or lease_until<now());
 update private.order_email_outbox q set state='cancelled',last_error='recipient_changed'
 where q.state in ('pending','processing') and (q.lease_until is null or q.lease_until<now())
 and not exists(select 1 from auth.users u where u.id=q.user_id and u.email_confirmed_at is not null
   and u.email=q.message->'to'->>0);
 return query
 with due as (
   select q.id from private.order_email_outbox q
   where q.state in ('pending','processing') and q.available_at<=now() and (q.is_test or v_enabled)
    and (q.lease_until is null or q.lease_until<now())
   order by q.created_at,q.id for update skip locked limit 5
 )
 update private.order_email_outbox q set state='processing',attempts=attempts+1,
   first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
 from due where q.id=due.id returning q.id,q.lease_token,q.message;
end; $$;
revoke all on function public.claim_order_emails() from public,anon,authenticated;
grant execute on function public.claim_order_emails() to service_role;

create function public.finish_order_email(p_id uuid,p_lease_token uuid,p_provider_id text default null,
 p_error text default null,p_retry boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if (p_provider_id is null)=(p_error is null) then raise exception 'Invalid outcome' using errcode='22023'; end if;
 if p_error is not null and p_error !~ '^(network|provider_[0-9]{3}|invalid_response)$' then
   raise exception 'Invalid error code' using errcode='22023'; end if;
 update private.order_email_outbox set
   state=case when p_provider_id is not null then 'sent' when p_retry and attempts<6 then 'pending' else 'failed' end,
   provider_id=left(p_provider_id,128),last_error=p_error,
   sent_at=case when p_provider_id is not null then now() else null end,
   available_at=now()+make_interval(mins=>least(60,5*attempts)),lease_until=null,lease_token=null
 where id=p_id and lease_token=p_lease_token and state='processing';
 get diagnostics v_count=row_count;
 return v_count=1;
end; $$;
revoke all on function public.finish_order_email(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_order_email(uuid,uuid,text,text,boolean) to service_role;

-- Metadata-only admin monitoring; no recipient, message body or provider keys are exposed.
create function public.admin_order_email_summary() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.store_admins where user_id=(select auth.uid())) then
   raise exception 'Administrator required' using errcode='42501'; end if;
 return jsonb_build_object('enabled',(select enabled from private.order_email_settings where id),
   'pending',(select count(*) from private.order_email_outbox where state in ('pending','processing')),
   'sent',(select count(*) from private.order_email_outbox where state='sent'),
   'failed',(select count(*) from private.order_email_outbox where state='failed'));
end; $$;
revoke all on function public.admin_order_email_summary() from public,anon;
grant execute on function public.admin_order_email_summary() to authenticated;
