-- Recovered from the hosted migration ledger; original version retained.
alter table public.order_request_items drop constraint if exists order_request_items_order_request_id_product_id_key;
