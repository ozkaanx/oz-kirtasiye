-- Recovered from the hosted migration ledger; original version retained.
-- Product reviews / verified purchasers
create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,user_id)
);
create index product_reviews_public_idx on public.product_reviews(product_id,created_at desc) where status='approved';
create index product_reviews_pending_idx on public.product_reviews(created_at desc) where status='pending';
alter table public.product_reviews enable row level security;
revoke all on public.product_reviews from public,anon,authenticated;
grant select,insert,update on public.product_reviews to authenticated;
grant select on public.product_reviews to anon;
create policy reviews_public_or_owned_select on public.product_reviews for select to anon,authenticated
 using (status='approved' or user_id=(select auth.uid()) or exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())));
create policy reviews_verified_insert on public.product_reviews for insert to authenticated
 with check (
  user_id=(select auth.uid()) and status='pending' and
  exists (select 1 from public.order_requests o join public.order_request_items i on i.order_request_id=o.id
    where o.customer_user_id=(select auth.uid()) and o.status in ('delivered','completed') and i.product_id=product_id)
 );
create or replace function public.submit_product_review(p_product_id uuid,p_rating integer,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_id uuid;
begin
 if v_user is null then raise exception 'Giriş yapmalısınız.' using errcode='42501'; end if;
 if p_rating not between 1 and 5 or char_length(btrim(coalesce(p_body,''))) not between 10 and 1000 then
  raise exception 'Puan veya yorum geçersiz.' using errcode='22023'; end if;
 if not exists(select 1 from public.order_requests o join public.order_request_items i on i.order_request_id=o.id
   where o.customer_user_id=v_user and o.status in ('delivered','completed') and i.product_id=p_product_id) then
  raise exception 'Yalnızca satın aldığınız ürünleri değerlendirebilirsiniz.' using errcode='42501'; end if;
 insert into public.product_reviews(product_id,user_id,rating,body,status)
 values(p_product_id,v_user,p_rating,btrim(p_body),'pending')
 on conflict(product_id,user_id) do update set rating=excluded.rating,body=excluded.body,status='pending',updated_at=now()
 returning id into v_id;
 return v_id;
end; $$;
create or replace function public.moderate_product_review(p_review_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.store_admins a where a.user_id=(select auth.uid())) then
  raise exception 'Yetkisiz işlem.' using errcode='42501'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Geçersiz durum.' using errcode='22023'; end if;
 update public.product_reviews set status=p_status,updated_at=now() where id=p_review_id;
 if not found then raise exception 'Yorum bulunamadı.' using errcode='22023'; end if;
end; $$;
revoke all on function public.submit_product_review(uuid,integer,text) from public,anon;
revoke all on function public.moderate_product_review(uuid,text) from public,anon;
grant execute on function public.submit_product_review(uuid,integer,text) to authenticated;
grant execute on function public.moderate_product_review(uuid,text) to authenticated;
