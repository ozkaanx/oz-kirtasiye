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
  order_request_items: CustomerOrderItem[];
};
