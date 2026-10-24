import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminReturns } from '@/components/admin/admin-returns';
import type { AdminReturnRequest, ReturnHistory, ReturnRequest } from '@/lib/returns';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'İade ve Değişim Yönetimi',
  robots: { index: false, follow: false },
};

export default async function AdminReturnsPage() {
  const supabase = await createServerSupabase();
  const { data: records, error } = await supabase
    .from('order_return_requests')
    .select(
      'id,order_request_id,order_item_id,quantity,request_type,reason,customer_note,status,admin_note,condition_on_receipt,restocked_quantity,received_at,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  const requests = (records ?? []) as ReturnRequest[];
  const orderIds = [...new Set(requests.map((r) => r.order_request_id))];
  const itemIds = [...new Set(requests.map((r) => r.order_item_id))];
  const returnIds = requests.map((r) => r.id);

  const [orders, items, invoices, histories] = await Promise.all([
    orderIds.length
      ? supabase
          .from('order_requests')
          .select(
            'id,reference,status,customer_name,phone,inventory_deducted_at,inventory_restored_at',
          )
          .in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? supabase
          .from('order_request_items')
          .select('id,product_name,variant_label,quantity')
          .in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from('order_invoice_register')
          .select('order_request_id,status')
          .in('order_request_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    returnIds.length
      ? supabase
          .from('order_return_status_history')
          .select('id,return_request_id,from_status,to_status,note,created_at')
          .in('return_request_id', returnIds)
          .order('created_at', { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const ordersMap = new Map((orders.data ?? []).map((o) => [o.id, o]));
  const itemsMap = new Map((items.data ?? []).map((i) => [i.id, i]));
  const invoicesMap = new Map(
    (invoices.data ?? []).map((i) => [i.order_request_id, i.status === 'issued']),
  );
  const allHistory = (histories.data ?? []) as ReturnHistory[];
  const entries: AdminReturnRequest[] = requests.map((r) => {
    const order = ordersMap.get(r.order_request_id);
    const item = itemsMap.get(r.order_item_id);
    return {
      ...r,
      order: order
        ? {
            reference: order.reference,
            status: order.status,
            customer_name: order.customer_name,
            phone: order.phone,
            inventory_deducted_at: order.inventory_deducted_at,
            inventory_restored_at: order.inventory_restored_at,
            invoice_issued: invoicesMap.get(r.order_request_id) ?? false,
          }
        : null,
      item: item
        ? {
            product_name: item.product_name,
            variant_label: item.variant_label,
            quantity: Number(item.quantity),
          }
        : null,
      history: allHistory.filter((h) => h.return_request_id === r.id),
    };
  });

  return (
    <AdminReturns
      entries={entries}
      loadError={
        error?.message ??
        orders.error?.message ??
        items.error?.message ??
        invoices.error?.message ??
        histories.error?.message ??
        null
      }
    />
  );
}
