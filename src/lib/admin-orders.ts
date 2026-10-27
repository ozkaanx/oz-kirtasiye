export type OrderStatus =
  | 'new'
  | 'contacted'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed' // Historical state from the previous implementation.
  | 'cancelled';
export type OrderAction = 'contact' | 'prepare' | 'ship' | 'deliver' | 'cancel' | 'pickup_collect';
type OrderItem = {
  id: string;
  product_name: string;
  variant_label?: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};
type OrderHistory = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
};
export type AdminOrderRequest = {
  id: string;
  reference: string;
  customer_name: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  note: string | null;
  status: OrderStatus;
  payment_status: 'not_collected';
  subtotal: number;
  delivery_method: 'legacy' | 'shipping' | 'pickup';
  shipping_fee: number;
  discount_amount: number;
  coupon_code: string | null;
  automatic_campaign_name: string | null;
  total: number;
  created_at: string;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  inventory_deducted_at: string | null;
  inventory_restored_at: string | null;
  cancellation_reason: string | null;
  order_request_items: OrderItem[];
  order_request_status_history: OrderHistory[];
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Yeni talep',
  contacted: 'Müşteriyle görüşüldü',
  processing: 'Hazırlanıyor',
  shipped: 'Kargoya verildi',
  delivered: 'Teslim edildi',
  completed: 'Eski kayıt · tamamlandı',
  cancelled: 'İptal edildi',
};

export function orderDateTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export type OrderActionDetails = { carrier: string; trackingNumber: string; cancelReason: string };
export type OrderFormKind = 'ship' | 'cancel' | null;
