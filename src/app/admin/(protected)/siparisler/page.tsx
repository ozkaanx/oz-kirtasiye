import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminOrderRequests } from '@/components/admin/admin-order-requests';
import {
  orderSearchArgs,
  parseOrderSearch,
  type OrderSearchResult,
} from '@/lib/admin-order-search';
import { operationTrace } from '@/lib/operation-trace';
export const metadata: Metadata = {
  title: 'Sipariş ve Kargo Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function AdminOrderRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = parseOrderSearch(await searchParams);
  const trace = operationTrace('admin_order_search');
  let result: OrderSearchResult | null = null;
  let loadError: string | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('admin_search_orders', orderSearchArgs(search));
    if (error) {
      trace.error('database_error', error.code);
      loadError = 'Siparişler yüklenemedi. Tekrar dene. Takip kodu: ' + trace.requestId;
    } else if (!data || !Array.isArray(data.rows)) {
      trace.error('empty_result');
      loadError = 'Sipariş sonucu alınamadı. Takip kodu: ' + trace.requestId;
    } else result = data as OrderSearchResult;
  } catch {
    trace.error('unexpected');
    loadError = 'Sipariş servisine ulaşılamadı. Takip kodu: ' + trace.requestId;
  }
  return (
    <AdminOrderRequests
      key={JSON.stringify(search)}
      result={result}
      search={search}
      loadError={loadError}
    />
  );
}
