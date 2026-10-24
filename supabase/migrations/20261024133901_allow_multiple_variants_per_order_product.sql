-- Previous unique order/product constraint prevented different color/size variants in one order.
alter table public.order_request_items drop constraint if exists order_request_items_order_request_id_product_id_key;
