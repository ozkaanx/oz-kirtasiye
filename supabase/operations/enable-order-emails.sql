-- Run only after the worker is deployed and ORDER_RESEND_API_KEY is configured.
-- In Supabase Vault, create order_email_service_role with the project's legacy
-- service_role JWT value. Enter it in the dashboard, never in this file/Git/chat.
-- The worker requires that service credential, not an anon key or user JWT.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.secrets where name='order_email_service_role') then
   raise exception 'Add order_email_service_role to Supabase Vault before enabling';
 end if;
end $$;
select cron.schedule('order-email-worker','*/5 * * * *', $job$
 select net.http_post(
   url:='https://dvkndlaamlwxikhszpqd.supabase.co/functions/v1/order-email-worker',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization',
     'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='order_email_service_role')),
   body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
update private.order_email_settings set enabled=true,enabled_at=now() where id;
commit;
