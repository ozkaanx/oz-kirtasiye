-- Legacy request function inserts subtotal without a total; populate it before the CHECK fires.
create or replace function private.order_request_default_total()
returns trigger language plpgsql set search_path=''
as $function$
begin
 if new.total = 0 and new.subtotal > 0 then new.total := new.subtotal; end if;
 return new;
end;
$function$;
revoke all on function private.order_request_default_total() from public,anon,authenticated;
create trigger order_requests_default_total before insert on public.order_requests
 for each row execute function private.order_request_default_total();
