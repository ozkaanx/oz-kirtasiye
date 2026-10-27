-- Recovered from the hosted migration ledger; original version retained.

do $m$
declare src text;
begin
 select pg_get_functiondef('public.submit_order_request_with_notices(text,text,text,text,text,text,jsonb,boolean,boolean,text)'::regprocedure) into src;
 if position('if p_notice_version is distinct from ''2026-10-24-v1'' then' in src)=0 then
  raise exception 'Expected notice-version guard not found';
 end if;
 src:=replace(src,'if p_notice_version is distinct from ''2026-10-24-v1'' then',
 'if p_notice_version is null or p_notice_version not in (''2026-10-24-v1'',''2026-10-24-v2'') then');
 execute src;
end $m$;
