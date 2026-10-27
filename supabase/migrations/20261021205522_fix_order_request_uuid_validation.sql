-- Recovered from the hosted migration ledger; original version retained.
do $do$ declare definition text; corrected text; begin
 select pg_get_functiondef('public.submit_order_request(text,text,text,text,text,text,jsonb)'::regprocedure) into definition;
 corrected := replace(definition, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
 if definition <> corrected then execute corrected; end if;
end $do$;
