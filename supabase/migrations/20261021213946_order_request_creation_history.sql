-- Initial timeline entry for newly submitted orders; old orders are backfilled once.
create or replace function private.order_request_initial_history()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  insert into public.order_request_status_history (
    order_request_id, from_status, to_status, note, changed_by, created_at
  ) values (new.id, null, new.status, 'Sipariş talebi oluşturuldu.', null, new.created_at);
  return new;
end;
$function$;
revoke all on function private.order_request_initial_history() from public, anon, authenticated;
create trigger order_requests_initial_history
  after insert on public.order_requests
  for each row execute function private.order_request_initial_history();

insert into public.order_request_status_history
  (order_request_id, from_status, to_status, note, changed_by, created_at)
select o.id, null, o.status,
  'Önceki sürümden aktarıldı; geçmiş işlem adımları kaydedilmemişti.',
  null, o.created_at
from public.order_requests o
where not exists (
  select 1 from public.order_request_status_history h where h.order_request_id = o.id
);
