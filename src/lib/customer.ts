export type CustomerProfile = {
  user_id: string;
  full_name: string;
  phone: string | null;
};

export type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  is_default: boolean;
  created_at: string;
};

export type CustomerOrderItem = {
  product_name: string;
  variant_label?: string | null;
  quantity: number;
  line_total: number;
};

export type CustomerOrder = {
  id: string;
  reference: string;
  created_at: string;
  status: string;
  payment_status: string;
  delivery_method: string;
  total: number;
  shipping_fee: number;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  discount_amount: number;
  coupon_code: string | null;
  automatic_campaign_name: string | null;
  order_request_items: CustomerOrderItem[];
  order_invoice_register?: {
    status: 'pending' | 'issued';
    document_type: 'e_arsiv' | 'e_fatura' | null;
    invoice_number: string | null;
    issue_date: string | null;
  } | null;
};
