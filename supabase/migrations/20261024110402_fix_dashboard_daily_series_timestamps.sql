-- Recovered from the hosted migration ledger; original version retained.

do $do$
declare d text;
begin
 select pg_get_functiondef('public.admin_dashboard_summary(integer)'::regprocedure) into d;
 d := replace(d,
  'pg_catalog.generate_series(v_today-13,v_today,1) as d(day)',
  'pg_catalog.generate_series((v_today-13)::timestamp,v_today::timestamp,interval ''1 day'') as d(day)');
 d := replace(d, '''date'', d.day::text', '''date'', d.day::date::text');
 d := replace(d, '= d.day', '= d.day::date');
 execute d;
end $do$;
