import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminInvoices, type InvoiceOrder } from '@/components/admin/admin-invoices';

export const metadata: Metadata = {
  title: 'Fatura Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminInvoicesPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('order_requests')
    .select(`
      id, reference, created_at, customer_name, phone, status, payment_status, total, discount_amount, coupon_code,
      delivery_method,
      order_billing_details(buyer_type,recipient_name,company_name,tax_office,tax_number,city,district,address),
      order_invoice_register(status,document_type,invoice_number,issue_date,provider,recorded_at)
    `)
    .order('created_at',{ascending:false})
    .limit(200);
  const orders: InvoiceOrder[] = (data ?? []).map((row) => {
    const details = Array.isArray(row.order_billing_details)
      ? row.order_billing_details[0] ?? null : row.order_billing_details;
    const registry = Array.isArray(row.order_invoice_register)
      ? row.order_invoice_register[0] ?? null : row.order_invoice_register;
    return {
      id: row.id,
      reference: row.reference,
      created_at: row.created_at,
      customer_name: row.customer_name,
      phone: row.phone,
      status: row.status,
      payment_status: row.payment_status,
      delivery_method: row.delivery_method,
      total: Number(row.total),
      discount_amount: Number(row.discount_amount),
      coupon_code: row.coupon_code,
      billing: details ?? null,
      invoice: registry ?? null,
    } as InvoiceOrder;
  });
  return <AdminInvoices orders={orders} loadError={error?.message ?? null} />;
}
