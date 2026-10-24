-- Historical migration. Safe on a fresh checkout where the initial function is already corrected.
do $do$
declare definition text;
begin
 select pg_get_functiondef('public.admin_dashboard_summary(integer)'::regprocedure) into definition;
 if position('pg_catalog.generate_series(v_today-13,v_today,1)' in definition) > 0 then
 definition := replace(definition,
   'pg_catalog.generate_series(v_today-13,v_today,1) as d(day)',
   'pg_catalog.generate_series((v_today-13)::timestamp,v_today::timestamp,interval ''1 day'') as d(day)');
 definition := replace(definition, '''date'', d.day::text', '''date'', d.day::date::text');
 definition := replace(definition, '= d.day', '= d.day::date');
 execute definition;
 end if;
end $do$;
