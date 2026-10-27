-- Recovered from the hosted migration ledger; original version retained.

do $do$
declare src text;
begin
 select pg_get_functiondef('public.admin_dashboard_summary(integer)'::regprocedure) into src;
 if pg_catalog.strpos(src, '''newRequests'', (select count(*) from public.order_requests where status = ''new''),') = 0 then
   raise exception 'Expected admin summary anchor missing';
 end if;
 src := pg_catalog.replace(src,
  '''newRequests'', (select count(*) from public.order_requests where status = ''new''),',
  '''newRequests'', (select count(*) from public.order_requests where status = ''new''),''contactedRequests'', (select count(*) from public.order_requests where status = ''contacted''),');
 execute src;
end $do$;
