-- Recovered from the hosted migration ledger; original version retained.

create or replace function private.prevent_simple_cancel_after_invoice()
returns trigger language plpgsql set search_path = ''
as $function$
begin
 if old.status is distinct from 'cancelled' and new.status = 'cancelled'
    and exists(select 1 from public.order_invoice_register r
      where r.order_request_id=new.id and r.status='issued') then
  raise exception 'Bu siparişin resmî faturası kaydedilmiş. Önce muhasebeci ile e-belge iptal/iade sürecini tamamlayın.'
   using errcode='22023';
 end if;
 return new;
end;
$function$;
revoke all on function private.prevent_simple_cancel_after_invoice() from public,anon,authenticated;
create trigger order_requests_invoice_cancel_guard before update of status on public.order_requests
for each row execute function private.prevent_simple_cancel_after_invoice();
