-- Recovered from the hosted migration ledger; original version retained.

create or replace function private.audit_initial_variant_stock() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
 if new.stock_quantity>0 then
  insert into public.variant_stock_movements(
   variant_id,quantity_before,change_quantity,quantity_after,note,changed_by
  ) values(new.id,0,new.stock_quantity,new.stock_quantity,'Varyant ilk stoğu',(select auth.uid()));
 end if;
 return new;
end;
$function$;
revoke all on function private.audit_initial_variant_stock() from public,anon,authenticated;
create trigger product_variants_initial_stock_audit after insert on public.product_variants
 for each row execute function private.audit_initial_variant_stock();
