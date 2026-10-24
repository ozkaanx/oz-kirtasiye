-- Move privileged implementations outside the exposed public API schema.
-- The public endpoints remain SECURITY INVOKER wrappers; internal functions
-- continue to verify the authenticated user and order ownership/admin role.
create schema if not exists returns_private;
revoke all on schema returns_private from public,anon,authenticated;
grant usage on schema returns_private to authenticated;
alter function public.customer_request_return(uuid,uuid,integer,text,text,text) set schema returns_private;
alter function public.admin_handle_return_request(uuid,text,text,boolean,boolean,text) set schema returns_private;
revoke all on function returns_private.customer_request_return(uuid,uuid,integer,text,text,text) from public,anon,authenticated;
revoke all on function returns_private.admin_handle_return_request(uuid,text,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function returns_private.customer_request_return(uuid,uuid,integer,text,text,text) to authenticated;
grant execute on function returns_private.admin_handle_return_request(uuid,text,text,boolean,boolean,text) to authenticated;
create or replace function public.customer_request_return(
 p_order_id uuid,p_item_id uuid,p_quantity integer,p_request_type text,p_reason text,p_note text
) returns uuid language sql security invoker set search_path=''
as $function$
 select returns_private.customer_request_return(p_order_id,p_item_id,p_quantity,p_request_type,p_reason,p_note);
$function$;
revoke all on function public.customer_request_return(uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.customer_request_return(uuid,uuid,integer,text,text,text) to authenticated;
create or replace function public.admin_handle_return_request(
 p_return_id uuid,p_action text,p_note text default null,p_restock boolean default false,
 p_invoice_reviewed boolean default false,p_condition text default null
) returns text language sql security invoker set search_path=''
as $function$
 select returns_private.admin_handle_return_request(p_return_id,p_action,p_note,p_restock,p_invoice_reviewed,p_condition);
$function$;
revoke all on function public.admin_handle_return_request(uuid,text,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_handle_return_request(uuid,text,text,boolean,boolean,text) to authenticated;
