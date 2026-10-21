import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminOrderRequests } from '@/components/admin/admin-order-requests';

export const metadata: Metadata = {
  title: 'Sipariş Talepleri',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminOrderRequestsPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('order_requests')
    .select(
      'id,reference,customer_name,phone,city,district,address,note,status,payment_status,subtotal,created_at,order_request_items(id,product_name,unit_price,quantity,line_total)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  return (
    <AdminOrderRequests
      requests={(data ?? []).map((row) => ({
        ...row,
        subtotal: Number(row.subtotal),
        order_request_items: (row.order_request_items ?? []).map((item) => ({
          ...item,
          unit_price: Number(item.unit_price),
          line_total: Number(item.line_total),
        })),
      }))}
      loadError={error?.message ?? null}
    />
  );
}
