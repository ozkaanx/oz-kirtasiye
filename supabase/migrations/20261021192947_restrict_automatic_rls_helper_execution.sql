-- Recovered from the hosted migration ledger; original version retained.
-- Hosted Supabase may install this helper; local stacks need not have it.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
