-- Recovered from the hosted migration ledger; original version retained.

do $do$
declare src text; rewritten text;
begin
 select pg_get_functiondef('public.manage_order_request(uuid,text,text,text,text)'::regprocedure) into src;
 rewritten:=replace(
  src,
  'for v_item in select product_id,quantity from public.order_request_items',
  'for v_item in select product_id,variant_id,quantity from public.order_request_items'
 );
 rewritten:=replace(rewritten,
  'where order_request_id=p_order_id order by product_id',
  'where order_request_id=p_order_id order by product_id,variant_id nulls first'
 );
 rewritten:=replace(rewritten,
  'update public.products p set stock_quantity=p.stock_quantity-v_item.quantity
     where p.id=v_item.product_id and p.stock_quantity>=v_item.quantity
     returning p.id into v_updated;
   if not found then raise exception ''Yetersiz stok: %'',v_item.product_id using errcode=''22023''; end if;',
  'if v_item.variant_id is not null then
     update public.product_variants pv set stock_quantity=pv.stock_quantity-v_item.quantity
       where pv.id=v_item.variant_id and pv.product_id=v_item.product_id
         and pv.stock_quantity>=v_item.quantity returning pv.id into v_updated;
     if not found then raise exception ''Varyant stoğu yetersiz: %'',v_item.variant_id using errcode=''22023''; end if;
   else
     update public.products p set stock_quantity=p.stock_quantity-v_item.quantity
       where p.id=v_item.product_id and p.stock_quantity>=v_item.quantity
       returning p.id into v_updated;
     if not found then raise exception ''Yetersiz stok: %'',v_item.product_id using errcode=''22023''; end if;
   end if;'
 );
 rewritten:=replace(rewritten,
  'update public.products p set stock_quantity=p.stock_quantity+v_item.quantity
     where p.id=v_item.product_id returning p.id into v_updated;
   if not found then raise exception ''Stok iadesinde ürün bulunamadı: %'',v_item.product_id using errcode=''22023''; end if;',
  'if v_item.variant_id is not null then
     update public.product_variants pv set stock_quantity=pv.stock_quantity+v_item.quantity
       where pv.id=v_item.variant_id and pv.product_id=v_item.product_id returning pv.id into v_updated;
     if not found then raise exception ''Stok iadesinde varyant bulunamadı: %'',v_item.variant_id using errcode=''22023''; end if;
   else
     update public.products p set stock_quantity=p.stock_quantity+v_item.quantity
       where p.id=v_item.product_id returning p.id into v_updated;
     if not found then raise exception ''Stok iadesinde ürün bulunamadı: %'',v_item.product_id using errcode=''22023''; end if;
   end if;'
 );
 if rewritten=src or strpos(rewritten,'Varyant stoğu yetersiz')=0 or
    strpos(rewritten,'Stok iadesinde varyant bulunamadı')=0 or
    strpos(rewritten,'for v_item in select product_id,variant_id,quantity')=0
 then raise exception 'Stok fonksiyonu otomatik güncellenemedi; mevcut tanım uyuşmuyor.'; end if;
 execute rewritten;
end $do$;
