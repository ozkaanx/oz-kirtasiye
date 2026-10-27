-- Recovered from the hosted migration ledger; original version retained.

create table if not exists public.order_billing_details (
 order_request_id uuid primary key references public.order_requests(id) on delete cascade,
 buyer_type text not null check (buyer_type in ('individual','corporate')),
 recipient_name text not null check (char_length(trim(recipient_name)) between 3 and 120),
 company_name text check (company_name is null or char_length(trim(company_name)) between 3 and 180),
 tax_office text check (tax_office is null or char_length(trim(tax_office)) between 2 and 100),
 tax_number text check (tax_number is null or tax_number ~ '^[0-9]{10}$'),
 city text not null check (char_length(trim(city)) between 2 and 80),
 district text not null check (char_length(trim(district)) between 2 and 80),
 address text not null check (char_length(trim(address)) between 10 and 500),
 created_at timestamptz not null default now(),
 constraint corporate_invoice_requires_tax_details check (buyer_type <> 'corporate' or (company_name is not null and tax_office is not null and tax_number is not null)),
 constraint individual_invoice_excludes_company check (buyer_type <> 'individual' or (company_name is null and tax_office is null and tax_number is null))
);
create table if not exists public.order_invoice_register (
 order_request_id uuid primary key references public.order_requests(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','issued')),
 document_type text check (document_type in ('e_arsiv','e_fatura')),
 invoice_number text unique,
 issue_date date,
 provider text check (provider is null or char_length(trim(provider)) between 2 and 120),
 recorded_by uuid references auth.users(id) on delete set null,
 recorded_at timestamptz,
 created_at timestamptz not null default now(),
 constraint issued_requires_official_reference check (
  (status='pending' and invoice_number is null and issue_date is null and document_type is null and recorded_at is null)
  or
  (status='issued' and invoice_number is not null and issue_date is not null and document_type is not null and recorded_at is not null)
 )
);
create index if not exists order_invoice_register_status_created_idx on public.order_invoice_register(status,created_at desc);
alter table public.order_billing_details enable row level security;
alter table public.order_invoice_register enable row level security;
revoke all on public.order_billing_details,public.order_invoice_register from public,anon,authenticated;
grant select on public.order_billing_details,public.order_invoice_register to authenticated;
grant update on public.order_invoice_register to authenticated;
create policy "billing_admin_or_order_owner_read" on public.order_billing_details
for select to authenticated using (
 exists(select 1 from public.store_admins a where a.user_id=(select auth.uid()))
 or exists(select 1 from public.order_requests o where o.id=order_request_id and o.customer_user_id=(select auth.uid()))
);
create policy "invoice_admin_or_order_owner_read" on public.order_invoice_register
for select to authenticated using (
 exists(select 1 from public.store_admins a where a.user_id=(select auth.uid()))
 or exists(select 1 from public.order_requests o where o.id=order_request_id and o.customer_user_id=(select auth.uid()))
);
create policy "invoice_admin_update" on public.order_invoice_register for update to authenticated
using (exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create or replace function private.guard_invoice_register()
returns trigger language plpgsql set search_path = ''
as $function$
begin
 if old.status='issued' then
  raise exception 'Kesilmiş fatura kaydı değiştirilemez; resmî düzeltme/iade süreci gerekir.' using errcode='22023';
 end if;
 if new.order_request_id <> old.order_request_id or new.created_at <> old.created_at then
  raise exception 'Fatura-sipariş ilişkisi değiştirilemez.' using errcode='22023';
 end if;
 return new;
end;
$function$;
revoke all on function private.guard_invoice_register() from public,anon,authenticated;
create trigger order_invoice_register_guard before update on public.order_invoice_register
for each row execute function private.guard_invoice_register();

create or replace function public.submit_order_request_with_billing(
 p_customer_name text,p_phone text,p_city text,p_district text,p_address text,
 p_note text,p_items jsonb,p_pre_information_read boolean,p_privacy_notice_read boolean,
 p_notice_version text,p_delivery_method text,p_customer_user_id uuid,p_billing jsonb
)
returns table(id uuid,reference text,subtotal numeric,shipping_fee numeric,total numeric,delivery_method text)
language plpgsql security definer set search_path = ''
as $function$
declare v_order record;
 v_buyer_type text;
 v_recipient text;
 v_company text;
 v_office text;
 v_vkn text;
 v_city text;
 v_district text;
 v_address text;
begin
 if p_billing is null or jsonb_typeof(p_billing) <> 'object' then
  raise exception 'Fatura bilgileri eksik.' using errcode='22023';
 end if;
 v_buyer_type := p_billing->>'buyerType';
 v_recipient := trim(coalesce(p_billing->>'recipientName',''));
 v_company := nullif(trim(coalesce(p_billing->>'companyName','')),'');
 v_office := nullif(trim(coalesce(p_billing->>'taxOffice','')),'');
 v_vkn := nullif(trim(coalesce(p_billing->>'taxNumber','')),'');
 v_city := trim(coalesce(p_billing->>'city',''));
 v_district := trim(coalesce(p_billing->>'district',''));
 v_address := trim(coalesce(p_billing->>'address',''));
 if v_buyer_type not in ('individual','corporate') or
    char_length(v_recipient) not between 3 and 120 or
    char_length(v_city) not between 2 and 80 or
    char_length(v_district) not between 2 and 80 or
    char_length(v_address) not between 10 and 500 then
  raise exception 'Fatura alıcı ve adres bilgileri geçersiz.' using errcode='22023';
 end if;
 if v_buyer_type='corporate' and (
  char_length(coalesce(v_company,'')) not between 3 and 180 or
  char_length(coalesce(v_office,'')) not between 2 and 100 or
  coalesce(v_vkn,'') !~ '^[0-9]{10}$') then
  raise exception 'Kurumsal fatura için unvan, vergi dairesi ve 10 haneli VKN gerekli.' using errcode='22023';
 end if;
 if v_buyer_type='individual' then
  v_company := null;
  v_office := null;
  v_vkn := null;
 end if;
 select * into v_order from public.submit_order_request_with_delivery_for_customer(
  p_customer_name,p_phone,p_city,p_district,p_address,p_note,p_items,
  p_pre_information_read,p_privacy_notice_read,p_notice_version,p_delivery_method,p_customer_user_id
 );
 if v_order.id is null then raise exception 'Sipariş oluşturulamadı.' using errcode='22023'; end if;
 insert into public.order_billing_details(order_request_id,buyer_type,recipient_name,company_name,tax_office,tax_number,city,district,address)
 values(v_order.id,v_buyer_type,v_recipient,v_company,v_office,v_vkn,v_city,v_district,v_address);
 insert into public.order_invoice_register(order_request_id) values(v_order.id);
 return query select v_order.id,v_order.reference,v_order.subtotal,v_order.shipping_fee,v_order.total,v_order.delivery_method;
end;
$function$;
revoke all on function public.submit_order_request_with_billing(text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb)
from public,anon,authenticated;
grant execute on function public.submit_order_request_with_billing(text,text,text,text,text,text,jsonb,boolean,boolean,text,text,uuid,jsonb) to service_role;

create or replace function public.admin_record_issued_invoice(
 p_order_id uuid,p_document_type text,p_invoice_number text,p_issue_date date,p_provider text default null
)
returns text language plpgsql security invoker set search_path=''
as $function$
declare v_number text := upper(trim(coalesce(p_invoice_number,'')));
 v_provider text := nullif(trim(coalesce(p_provider,'')),'');
 v_order_status text;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.store_admins a where a.user_id=(select auth.uid())
 ) then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_document_type not in ('e_arsiv','e_fatura') or
    v_number !~ '^[A-Z0-9]{16}$' or
    p_issue_date is null or p_issue_date > current_date or p_issue_date < (current_date - 3650)
 then raise exception 'Geçerli belge türü, 16 haneli resmî fatura numarası ve tarihi gir.' using errcode='22023'; end if;
 if v_provider is not null and char_length(v_provider) not between 2 and 120 then
  raise exception 'Entegratör adı geçersiz.' using errcode='22023'; end if;
 select status into v_order_status from public.order_requests where id=p_order_id;
 if not found then raise exception 'Sipariş bulunamadı.' using errcode='22023'; end if;
 if v_order_status in ('new','cancelled') then
  raise exception 'Yeni veya iptal edilmiş talebe bu panelden kesilmiş fatura kaydı girilemez.' using errcode='22023';
 end if;
 update public.order_invoice_register
 set status='issued',document_type=p_document_type,invoice_number=v_number,issue_date=p_issue_date,
     provider=v_provider,recorded_at=now(),recorded_by=(select auth.uid())
 where order_request_id=p_order_id and status='pending';
 if not found then raise exception 'Bekleyen fatura kaydı bulunamadı veya zaten kaydedilmiş.' using errcode='22023'; end if;
 return 'issued';
end;
$function$;
revoke all on function public.admin_record_issued_invoice(uuid,text,text,date,text) from public,anon,authenticated;
grant execute on function public.admin_record_issued_invoice(uuid,text,text,date,text) to authenticated;
