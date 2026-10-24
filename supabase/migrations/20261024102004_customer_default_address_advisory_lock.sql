-- The authenticated role cannot lock rows in auth.users.
-- Serialize changes with a transaction-scoped advisory lock per user instead.
create or replace function public.set_default_customer_address(p_address_id uuid)
returns void language plpgsql security invoker set search_path=''
as $function$
declare v_user_id uuid := (select auth.uid());
begin
 if v_user_id is null then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text,7319));
 if not exists(select 1 from public.customer_addresses a where a.id=p_address_id and a.user_id=v_user_id) then
   raise exception 'Adres bulunamadı.' using errcode='22023';
 end if;
 update public.customer_addresses set is_default=false where user_id=v_user_id and is_default=true;
 update public.customer_addresses set is_default=true where id=p_address_id and user_id=v_user_id;
end;
$function$;
