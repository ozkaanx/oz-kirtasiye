import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { CustomerReturns } from '@/components/account/customer-returns';
import type { ReturnHistory, ReturnOrder, ReturnRequest } from '@/lib/returns';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'İade ve Değişim Taleplerim',
  robots: { index: false, follow: false },
};

export default async function CustomerReturnsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect('/giris?next=%2Fhesabim%2Fiade');

  const [ordersResult, requestsResult] = await Promise.all([
    supabase
      .from('order_requests')
      .select(
        'id,reference,status,created_at,order_request_items(id,product_name,variant_label,quantity)',
      )
      .eq('customer_user_id', user.id)
      .in('status', ['delivered', 'completed'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('order_return_requests')
      .select(
        'id,order_request_id,order_item_id,quantity,request_type,reason,customer_note,status,admin_note,condition_on_receipt,restocked_quantity,received_at,created_at',
      )
      .eq('customer_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  const requests = (requestsResult.data ?? []) as ReturnRequest[];
  const ids = requests.map((r) => r.id);
  const historyResult = ids.length
    ? await supabase
        .from('order_return_status_history')
        .select('id,return_request_id,from_status,to_status,note,created_at')
        .in('return_request_id', ids)
        .order('created_at', { ascending: true })
        .limit(500)
    : { data: [] as ReturnHistory[], error: null };

  const orders: ReturnOrder[] = (ordersResult.data ?? []).map((order) => ({
    id: order.id,
    reference: order.reference,
    status: order.status,
    created_at: order.created_at,
    order_request_items: (order.order_request_items ?? []).map((item) => ({
      id: item.id,
      product_name: item.product_name,
      variant_label: item.variant_label,
      quantity: Number(item.quantity),
    })),
  }));

  return (
    <CustomerReturns
      orders={orders}
      requests={requests}
      history={(historyResult.data ?? []) as ReturnHistory[]}
      loadError={
        ordersResult.error?.message ??
        requestsResult.error?.message ??
        historyResult.error?.message ??
        null
      }
    />
  );
}
