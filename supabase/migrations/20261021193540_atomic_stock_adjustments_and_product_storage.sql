-- Recovered from the hosted migration ledger; original version retained.

create or replace function private.audit_stock_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'INSERT' and new.stock_quantity > 0 then
  insert into public.stock_movements(product_id,quantity_before,change_quantity,quantity_after,reason,changed_by,note)
  values(new.id,0,new.stock_quantity,new.stock_quantity,'initial',auth.uid(),'İlk stok kaydı');
 elsif TG_OP = 'UPDATE' and old.stock_quantity is distinct from new.stock_quantity then
  insert into public.stock_movements(product_id,quantity_before,change_quantity,quantity_after,reason,changed_by,note)
  values(new.id,old.stock_quantity,new.stock_quantity-old.stock_quantity,new.stock_quantity,
    case when auth.uid() is null then 'system' else 'manual_adjustment' end, auth.uid(),
    nullif(current_setting('app.stock_note',true),''));
 end if;
 return new;
end;
$$;
revoke all on function private.audit_stock_change() from public, anon, authenticated;

create function public.adjust_product_stock(p_product_id uuid,p_change integer,p_note text default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
 v_stock integer;
begin
 if p_change = 0 or abs(p_change::bigint) > 100000 then
  raise exception 'Geçersiz stok değişimi';
 end if;
 if not exists (select 1 from public.store_admins where user_id = auth.uid()) then
  raise exception 'Yönetici yetkisi gerekli' using errcode = '42501';
 end if;
 perform set_config('app.stock_note',left(coalesce(trim(p_note),''),250),true);
 update public.products
 set stock_quantity = stock_quantity + p_change
 where id = p_product_id and stock_quantity + p_change >= 0
 returning stock_quantity into v_stock;
 if not found then
  raise exception 'Ürün bulunamadı veya stok yetersiz';
 end if;
 return v_stock;
end;
$$;
revoke all on function public.adjust_product_stock(uuid,integer,text) from public, anon;
grant execute on function public.adjust_product_stock(uuid,integer,text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "Store admins can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and exists
 (select 1 from public.store_admins where user_id = (select auth.uid())));

create policy "Store admins can update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and exists
 (select 1 from public.store_admins where user_id = (select auth.uid())))
with check (bucket_id = 'product-images' and exists
 (select 1 from public.store_admins where user_id = (select auth.uid())));

create policy "Store admins can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and exists
 (select 1 from public.store_admins where user_id = (select auth.uid())));
