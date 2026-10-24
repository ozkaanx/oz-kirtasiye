-- Already applied to the hosted Öz Kırtasiye project on 2026-10-24.
-- Store contact details here are public business information; do not add secrets to this table.
create table if not exists public.store_settings(
 id smallint primary key default 1 check (id=1),
 brand_name text not null check(char_length(brand_name) between 2 and 100),
 legal_name text not null check(char_length(legal_name) between 5 and 160),
 tax_office text,
 tax_number text,
 mersis_number text,
 registered_address text not null,
 support_phone text,
 support_email text,
 whatsapp_phone text,
 business_hours text,
 return_address text,
 shipping_information text,
 return_instructions text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint store_settings_phone_length check (support_phone is null or char_length(support_phone) between 10 and 30),
 constraint store_settings_email_length check (support_email is null or char_length(support_email) <= 160)
);
insert into public.store_settings(id,brand_name,legal_name,tax_number,mersis_number,registered_address)
values(1,'Öz Kırtasiye','ESEN KIRTASİYE SAMİ TATAR','36398117570','3639811757000011',
 'Güneşli Mahallesi, Fevzi Çakmak Caddesi No:52/B, Bağcılar / İstanbul')
on conflict(id) do nothing;
create trigger store_settings_touch_updated_at before update on public.store_settings
 for each row execute function private.touch_updated_at();
alter table public.store_settings enable row level security;
revoke all on public.store_settings from public,anon,authenticated;
grant select on public.store_settings to anon,authenticated;
grant update on public.store_settings to authenticated;
create policy "store_settings_public_read" on public.store_settings for select to anon,authenticated using(true);
create policy "store_settings_admin_update" on public.store_settings for update to authenticated
 using(exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())))
 with check(id=1 and exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));

alter table public.order_requests
 add column if not exists pre_information_acknowledged_at timestamptz,
 add column if not exists privacy_notice_acknowledged_at timestamptz,
 add column if not exists notice_version text;

-- This wrapper records both disclosures within the same DB transaction as creating the request.
-- It does not collect marketing consent and is only available to the server service role.
create or replace function public.submit_order_request_with_notices(
 p_customer_name text,p_phone text,p_city text,p_district text,
 p_address text,p_note text,p_items jsonb,
 p_pre_information_read boolean,p_privacy_notice_read boolean,p_notice_version text
)
returns table(id uuid,reference text,subtotal numeric)
language plpgsql security definer set search_path=''
as $function$
declare v_record record;
begin
 if p_pre_information_read is distinct from true or p_privacy_notice_read is distinct from true then
   raise exception 'Ön bilgilendirme ve gizlilik açıklaması okunmalıdır.' using errcode='22023';
 end if;
 if p_notice_version is distinct from '2026-10-24-v1' then
   raise exception 'Bilgilendirme metni değişti; sayfayı yenileyin.' using errcode='22023';
 end if;
 select * into v_record from public.submit_order_request(
   p_customer_name,p_phone,p_city,p_district,p_address,p_note,p_items);
 if v_record.id is null then raise exception 'Sipariş talebi oluşturulamadı.' using errcode='22023'; end if;
 update public.order_requests as o
 set pre_information_acknowledged_at=now(),privacy_notice_acknowledged_at=now(),notice_version=p_notice_version
 where o.id=v_record.id;
 return query select v_record.id,v_record.reference,v_record.subtotal;
end;
$function$;
revoke all on function public.submit_order_request_with_notices(text,text,text,text,text,text,jsonb,boolean,boolean,text)
 from public,anon,authenticated;
grant execute on function public.submit_order_request_with_notices(text,text,text,text,text,text,jsonb,boolean,boolean,text)
 to service_role;
