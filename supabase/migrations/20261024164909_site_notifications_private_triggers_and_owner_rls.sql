-- Already applied to the Oz Kirtasiye Supabase project.
-- This file tracks the installed migration in git; DO NOT rerun it on that project.
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('admin','customer')),
  event_type text not null check (event_type in ('order_created','order_updated','return_created','return_updated')),
  event_key text not null check (char_length(event_key) between 8 and 160),
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 3 and 500),
  href text not null check (
    (audience='admin' and href in ('/admin/siparisler','/admin/iadeler'))
    or (audience='customer' and href in ('/hesabim','/hesabim/iade'))
  ),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_unique_event unique(recipient_user_id,audience,event_key)
);
create index user_notifications_recent_idx on public.user_notifications(recipient_user_id,audience,created_at desc);
create index user_notifications_unread_idx on public.user_notifications(recipient_user_id,audience,created_at desc) where read_at is null;
alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from public,anon,authenticated;
grant select,update(read_at) on public.user_notifications to authenticated;
create policy notifications_own_select on public.user_notifications for select to authenticated
 using (recipient_user_id=(select auth.uid()));
create policy notifications_own_read_update on public.user_notifications for update to authenticated
 using (recipient_user_id=(select auth.uid()))
 with check (recipient_user_id=(select auth.uid()));

create schema if not exists notifications_private;
revoke all on schema notifications_private from public,anon,authenticated;

create or replace function notifications_private.insert_notification(
 p_user uuid,p_audience text,p_type text,p_key text,p_title text,p_body text,p_href text
) returns void language plpgsql security definer set search_path=''
as $fn$
begin
 if p_user is null then return; end if;
 insert into public.user_notifications (
  recipient_user_id,audience,event_type,event_key,title,body,href
 ) values (p_user,p_audience,p_type,p_key,p_title,p_body,p_href)
 on conflict(recipient_user_id,audience,event_key) do nothing;
end;
$fn$;
revoke all on function notifications_private.insert_notification(uuid,text,text,text,text,text,text) from public,anon,authenticated;

create or replace function notifications_private.order_notifications()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_label text; v_admin record;
begin
 if tg_op='INSERT' then
  for v_admin in select user_id from public.store_admins loop
   perform notifications_private.insert_notification(
    v_admin.user_id,'admin','order_created',
    'order:'||new.id::text||':created','Yeni sipariş talebi',
    new.reference||' numaralı sipariş talebi alındı.','/admin/siparisler'
   );
  end loop;
  if new.customer_user_id is not null then
   perform notifications_private.insert_notification(
    new.customer_user_id,'customer','order_created',
    'order:'||new.id::text||':created','Sipariş talebiniz alındı',
    new.reference||' numaralı talebiniz kaydedildi.','/hesabim'
   );
  end if;
 elsif tg_op='UPDATE' then
  if old.customer_user_id is null and new.customer_user_id is not null then
   perform notifications_private.insert_notification(
    new.customer_user_id,'customer','order_created',
    'order:'||new.id::text||':created','Sipariş talebiniz alındı',
    new.reference||' numaralı talebiniz kaydedildi.','/hesabim'
   );
  end if;
  if new.status is distinct from old.status and new.customer_user_id is not null then
   v_label:=case new.status
    when 'contacted' then 'Müşteriyle görüşüldü'
    when 'processing' then 'Sipariş hazırlanıyor'
    when 'shipped' then 'Sipariş kargoya verildi'
    when 'delivered' then 'Sipariş teslim edildi'
    when 'completed' then 'Sipariş tamamlandı'
    when 'cancelled' then 'Sipariş iptal edildi'
    else 'Sipariş durumu güncellendi'
   end;
   perform notifications_private.insert_notification(
    new.customer_user_id,'customer','order_updated',
    'order:'||new.id::text||':status:'||new.status,
    v_label,new.reference||' numaralı siparişiniz: '||v_label||'.','/hesabim'
   );
  end if;
 end if;
 return new;
exception when others then
 raise warning 'Order notification creation failed: %',sqlerrm;
 return new;
end;
$fn$;
revoke all on function notifications_private.order_notifications() from public,anon,authenticated;
create trigger store_notify_new_order after insert on public.order_requests
 for each row execute function notifications_private.order_notifications();
create trigger store_notify_order_changes after update of status,customer_user_id on public.order_requests
 for each row execute function notifications_private.order_notifications();

create or replace function notifications_private.return_notifications()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_reference text; v_kind text; v_status_label text; v_admin record;
begin
 select reference into v_reference from public.order_requests where id=new.order_request_id;
 v_kind:=case new.request_type when 'exchange' then 'Değişim' else 'İade' end;
 if tg_op='INSERT' then
  for v_admin in select user_id from public.store_admins loop
   perform notifications_private.insert_notification(
    v_admin.user_id,'admin','return_created',
    'return:'||new.id::text||':created','Yeni '||lower(v_kind)||' talebi',
    coalesce(v_reference,'Sipariş')||' için '||lower(v_kind)||' talebi oluşturuldu.','/admin/iadeler'
   );
  end loop;
 elsif tg_op='UPDATE' and new.status is distinct from old.status then
  v_status_label:=case new.status
   when 'approved' then 'onaylandı'
   when 'rejected' then 'reddedildi'
   when 'received' then 'mağazaya ulaştı'
   when 'closed' then 'sonuçlandırıldı'
   else 'güncellendi'
  end;
  perform notifications_private.insert_notification(
   new.customer_user_id,'customer','return_updated',
   'return:'||new.id::text||':status:'||new.status,
   v_kind||' talebiniz '||v_status_label,
   coalesce(v_reference,'Sipariş')||' için '||lower(v_kind)||' talebiniz '||v_status_label||'.',
   '/hesabim/iade'
  );
 end if;
 return new;
exception when others then
 raise warning 'Return notification creation failed: %',sqlerrm;
 return new;
end;
$fn$;
revoke all on function notifications_private.return_notifications() from public,anon,authenticated;
create trigger store_notify_new_return after insert on public.order_return_requests
 for each row execute function notifications_private.return_notifications();
create trigger store_notify_return_changes after update of status on public.order_return_requests
 for each row execute function notifications_private.return_notifications();
