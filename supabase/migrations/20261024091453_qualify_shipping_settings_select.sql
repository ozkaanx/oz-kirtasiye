-- Recovered from the hosted migration ledger; original version retained.

do $m$
declare src text;
begin
 select pg_get_functiondef('public.submit_order_request_with_delivery(text,text,text,text,text,text,jsonb,boolean,boolean,text,text)'::regprocedure) into src;
 if position('from public.store_settings where id=1 for share;' in src)=0 then
  raise exception 'Expected function definition substring not found';
 end if;
 src:=replace(src,'from public.store_settings where id=1 for share;',
 'from public.store_settings where store_settings.id=1 for share;');
 execute src;
end $m$;
