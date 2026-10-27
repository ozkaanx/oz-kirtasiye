-- Recovered from the hosted migration ledger; original version retained.

create table if not exists public.order_return_requests (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_request_items(id) on delete restrict,
  customer_user_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null check (request_type in ('return','exchange')),
  quantity integer not null check (quantity between 1 and 99),
  reason text not null check (reason in ('changed_mind','damaged','wrong_item','other')),
  customer_note text not null check (char_length(btrim(customer_note)) between 10 and 1000),
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','received','closed')),
  admin_note text,
  condition_on_receipt text check (condition_on_receipt in ('resellable','damaged','unknown')),
  received_at timestamptz,
  closed_at timestamptz,
  restocked_at timestamptz,
  restocked_quantity integer not null default 0 check (restocked_quantity >= 0),
  invoice_review_confirmed_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_return_stock_limit check (restocked_quantity <= quantity),
  constraint order_return_physical_receipt check (
    (status in ('requested','approved','rejected') and received_at is null and restocked_at is null and restocked_quantity=0)
    or (status in ('received','closed') and received_at is not null)
  ),
  constraint order_return_only_closed_restock check (
    restocked_quantity=0 or (status='closed' and restocked_at is not null and condition_on_receipt='resellable')
  )
);
create index if not exists order_return_by_order_idx on public.order_return_requests(order_request_id,created_at desc);
create index if not exists order_return_status_idx on public.order_return_requests(status,created_at desc);
create index if not exists order_return_customer_idx on public.order_return_requests(customer_user_id,created_at desc);
create table if not exists public.order_return_status_history (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.order_return_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists return_status_history_idx on public.order_return_status_history(return_request_id,created_at);
alter table public.order_return_requests enable row level security;
alter table public.order_return_status_history enable row level security;
revoke all on public.order_return_requests,public.order_return_status_history from public,anon,authenticated;
grant select on public.order_return_requests,public.order_return_status_history to authenticated;
create policy "order_return_owner_or_admin_read" on public.order_return_requests for select to authenticated
using (
  customer_user_id=(select auth.uid())
  or exists(select 1 from public.store_admins a where a.user_id=(select auth.uid()))
);
create policy "order_return_history_owner_or_admin_read" on public.order_return_status_history for select to authenticated
using (
  exists(select 1 from public.order_return_requests r
    where r.id=return_request_id and r.customer_user_id=(select auth.uid()))
  or exists(select 1 from public.store_admins a where a.user_id=(select auth.uid()))
);
create or replace function public.customer_request_return(
  p_order_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_request_type text,
  p_reason text,
  p_note text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=(select auth.uid());
  v_order public.order_requests%rowtype;
  v_item public.order_request_items%rowtype;
  v_claimed integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'İade talebi oluşturmak için giriş yapmalısın.' using errcode='42501';
  end if;
  if p_quantity is null or p_quantity<1 or p_quantity>99
    or p_request_type is null or p_request_type not in ('return','exchange')
    or p_reason is null or p_reason not in ('changed_mind','damaged','wrong_item','other')
    or char_length(btrim(coalesce(p_note,''))) not between 10 and 1000 then
    raise exception 'İade/değişim bilgileri geçersiz.' using errcode='22023';
  end if;
  select * into v_order from public.order_requests o where o.id=p_order_id for update;
  if not found or v_order.customer_user_id is distinct from v_user then
    raise exception 'Sipariş bulunamadı veya bu hesaba ait değil.' using errcode='42501';
  end if;
  if v_order.status not in ('delivered','completed') then
    raise exception 'İade veya değişim için siparişin teslim edilmiş olması gerekir.' using errcode='22023';
  end if;
  select * into v_item from public.order_request_items i
   where i.id=p_item_id and i.order_request_id=p_order_id;
  if not found then
    raise exception 'Sipariş ürünü bulunamadı.' using errcode='22023';
  end if;
  select coalesce(sum(r.quantity),0)::integer into v_claimed
    from public.order_return_requests r
    where r.order_item_id=p_item_id and r.status<>'rejected';
  if v_claimed+p_quantity>v_item.quantity then
    raise exception 'Bu ürün için istenen miktar, kalan iade/değişim hakkını aşıyor.' using errcode='22023';
  end if;
  insert into public.order_return_requests (
    order_request_id,order_item_id,customer_user_id,request_type,quantity,reason,customer_note
  ) values(
    p_order_id,p_item_id,v_user,p_request_type,p_quantity,p_reason,btrim(p_note)
  ) returning id into v_id;
  insert into public.order_return_status_history (
    return_request_id,from_status,to_status,note,changed_by
  ) values(v_id,null,'requested','Müşteri talebi oluşturuldu.',v_user);
  return v_id;
end;
$function$;
revoke all on function public.customer_request_return(uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.customer_request_return(uuid,uuid,integer,text,text,text) to authenticated;
create or replace function public.admin_handle_return_request(
 p_return_id uuid,
 p_action text,
 p_note text default null,
 p_restock boolean default false,
 p_invoice_reviewed boolean default false,
 p_condition text default null
) returns text language plpgsql security definer set search_path=''
as $function$
declare
 v_actor uuid:=(select auth.uid());
 v_req public.order_return_requests%rowtype;
 v_order public.order_requests%rowtype;
 v_item public.order_request_items%rowtype;
 v_next text;
 v_note text:=nullif(btrim(coalesce(p_note,'')),'');
 v_issued boolean:=false;
 v_updated_stock integer;
begin
 if v_actor is null or not exists(select 1 from public.store_admins a where a.user_id=v_actor) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('approve','reject','receive','close')
   or char_length(coalesce(v_note,''))>1000 then
  raise exception 'Geçersiz işlem.' using errcode='22023';
 end if;
 select * into v_req from public.order_return_requests r where r.id=p_return_id for update;
 if not found then raise exception 'Talep bulunamadı.' using errcode='22023'; end if;
 select * into v_order from public.order_requests o where o.id=v_req.order_request_id for update;
 select * into v_item from public.order_request_items i where i.id=v_req.order_item_id;
 v_next:=case p_action
   when 'approve' then 'approved'
   when 'reject' then 'rejected'
   when 'receive' then 'received'
   when 'close' then 'closed' end;
 if (v_req.status='requested' and v_next in ('approved','rejected'))
   or (v_req.status='approved' and v_next='received')
   or (v_req.status='received' and v_next='closed') then null;
 else raise exception 'Bu talep durumunda seçilen işlem yapılamaz.' using errcode='22023'; end if;
 if v_next in ('rejected','closed') and char_length(coalesce(v_note,''))<10 then
  raise exception 'Karar ve sonuç için en az 10 karakter açıklama gerekli.' using errcode='22023';
 end if;
 if p_restock and (v_next<>'closed' or p_condition is distinct from 'resellable') then
  raise exception 'Stok yalnızca ürün teslim alınıp satılabilir olarak doğrulandıktan sonra artırılabilir.' using errcode='22023';
 end if;
 if v_next='closed' and (p_condition is null or p_condition not in ('resellable','damaged','unknown')) then
  raise exception 'Ürünün fiziksel durumunu seçmelisin.' using errcode='22023';
 end if;
 if v_next='closed' then
  select exists(select 1 from public.order_invoice_register reg
    where reg.order_request_id=v_req.order_request_id and reg.status='issued') into v_issued;
  if v_issued and not p_invoice_reviewed then
   raise exception 'Resmî fatura kaydı var: muhasebe düzeltme/iade sürecini kontrol ettiğini onaylamalısın.' using errcode='22023';
  end if;
 end if;
 if p_restock then
  if v_order.inventory_deducted_at is null or v_order.inventory_restored_at is not null then
   raise exception 'Bu siparişte güvenilir stok düşüm kaydı yok veya stok önceden iade edilmiş. Otomatik stok artırılamaz.' using errcode='22023';
  end if;
  perform pg_catalog.set_config('app.stock_note', 'Fiziksel iade: '||v_req.id::text,true);
  if v_item.variant_id is not null then
    update public.product_variants pv set stock_quantity=pv.stock_quantity+v_req.quantity
     where pv.id=v_item.variant_id and pv.product_id=v_item.product_id
     returning stock_quantity into v_updated_stock;
  else
    update public.products p set stock_quantity=p.stock_quantity+v_req.quantity
     where p.id=v_item.product_id returning stock_quantity into v_updated_stock;
  end if;
  if not found then raise exception 'Stok artırılacak ürün bulunamadı.' using errcode='22023'; end if;
 end if;
 update public.order_return_requests r set
   status=v_next,admin_note=coalesce(v_note,r.admin_note),updated_by=v_actor,updated_at=now(),
   received_at=case when v_next='received' then now() else r.received_at end,
   closed_at=case when v_next='closed' then now() else r.closed_at end,
   condition_on_receipt=case when v_next='closed' then p_condition else r.condition_on_receipt end,
   restocked_quantity=case when p_restock then v_req.quantity else r.restocked_quantity end,
   restocked_at=case when p_restock then now() else r.restocked_at end,
   invoice_review_confirmed_at=case when v_next='closed' and v_issued and p_invoice_reviewed then now() else r.invoice_review_confirmed_at end
 where r.id=v_req.id;
 insert into public.order_return_status_history(
  return_request_id,from_status,to_status,note,changed_by
 ) values(v_req.id,v_req.status,v_next,
   concat_ws(' · ',v_note,
    case when p_restock then 'Satılabilir stok +'||v_req.quantity else null end,
    case when v_next='closed' and v_issued and p_invoice_reviewed then 'Muhasebe kontrolü onaylandı' else null end),
   v_actor);
 return v_next;
end;
$function$;
revoke all on function public.admin_handle_return_request(uuid,text,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_handle_return_request(uuid,text,text,boolean,boolean,text) to authenticated;
