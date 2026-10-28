export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'closed';
export type ReturnKind = 'return' | 'exchange';
export type ReturnReason = 'changed_mind' | 'damaged' | 'wrong_item' | 'other';

export const RETURN_STATUS: Record<ReturnStatus, string> = {
  requested: 'İnceleme bekliyor',
  approved: 'Talep onaylandı',
  rejected: 'Talep reddedildi',
  received: 'Ürün fiziksel olarak teslim alındı',
  closed: 'İşlem tamamlandı',
};
export const RETURN_REASONS: Record<ReturnReason, string> = {
  changed_mind: 'Vazgeçtim / ihtiyacım değişti',
  damaged: 'Ürün hasarlı veya kusurlu',
  wrong_item: 'Yanlış ürün gönderildi',
  other: 'Diğer',
};
export const RETURN_KIND: Record<ReturnKind, string> = {
  return: 'İade',
  exchange: 'Değişim',
};

export type ReturnHistory = {
  id: string;
  return_request_id: string;
  from_status: string | null;
  to_status: ReturnStatus;
  note: string | null;
  created_at: string;
};

export type ReturnRequest = {
  order_reference?: string;
  product_name?: string;
  variant_label?: string | null;
  id: string;
  order_request_id: string;
  order_item_id: string;
  quantity: number;
  request_type: ReturnKind;
  reason: ReturnReason;
  customer_note: string;
  status: ReturnStatus;
  admin_note: string | null;
  condition_on_receipt: 'resellable' | 'damaged' | 'unknown' | null;
  restocked_quantity: number;
  received_at: string | null;
  created_at: string;
};

export type ReturnOrder = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  order_request_items: Array<{
    id: string;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    claimed_quantity: number;
  }>;
};

export type AdminReturnRequest = ReturnRequest & {
  order: {
    reference: string;
    status: string;
    customer_name: string;
    phone: string;
    inventory_deducted_at: string | null;
    inventory_restored_at: string | null;
    invoice_issued: boolean;
  } | null;
  item: {
    product_name: string;
    variant_label: string | null;
    quantity: number;
  } | null;
  history: ReturnHistory[];
};

export function returnDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
