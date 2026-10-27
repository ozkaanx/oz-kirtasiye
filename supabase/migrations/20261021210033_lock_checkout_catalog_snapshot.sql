-- Recovered from the hosted migration ledger; original version retained.
do $do$
declare definition text; corrected text;
begin
 select pg_get_functiondef('public.submit_order_request(text,text,text,text,text,text,jsonb)'::regprocedure)
 into definition;
 corrected := replace(
   definition,
   'where p.id = v_product_id and p.is_active = true;',
   'where p.id = v_product_id and p.is_active = true FOR SHARE;'
 );
 if corrected <> definition then execute corrected; end if;
end $do$;
