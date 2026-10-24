import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  AdminOrderRequests,
  type AdminOrderRequest,
} from '@/components/admin/admin-order-requests';

export const metadata: Metadata = {
  title: 'Sipariş ve Kargo Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminOrderRequestsPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('order_requests')
    .select(
      `
      id, reference, customer_name, phone, city, district, address, note,
      status, payment_status, subtotal, delivery_method, shipping_fee, total, created_at, carrier, tracking_number,
      shipped_at, delivered_at, inventory_deducted_at, inventory_restored_at,
      cancellation_reason,
      order_request_items(id, product_name, unit_price, quantity, line_total),
      order_request_status_history(id, from_status, to_status, note, created_at),
      order_billing_details(buyer_type,recipient_name,company_name,tax_office,tax_number,city,district,address),
      order_invoice_register(status,document_type,invoice_number,issue_date,provider)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const requests: AdminOrderRequest[] = (data ?? []).map((row) => ({
    ...row,
    order_billing_details: (Array.isArray(row.order_billing_details)
      ? (row.order_billing_details[0] ?? null)
      : (row.order_billing_details ?? null)) as AdminOrderRequest['order_billing_details'],
    order_invoice_register: (Array.isArray(row.order_invoice_register)
      ? (row.order_invoice_register[0] ?? null)
      : (row.order_invoice_register ?? null)) as AdminOrderRequest['order_invoice_register'],
    status: row.status as AdminOrderRequest['status'],
    payment_status: row.payment_status as AdminOrderRequest['payment_status'],
    subtotal: Number(row.subtotal),
    shipping_fee: Number(row.shipping_fee),
    total: Number(row.total),
    delivery_method: row.delivery_method as AdminOrderRequest['delivery_method'],
    order_request_items: (row.order_request_items ?? []).map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    order_request_status_history: (row.order_request_status_history ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

  return <AdminOrderRequests requests={requests} loadError={error?.message ?? null} />;
}
