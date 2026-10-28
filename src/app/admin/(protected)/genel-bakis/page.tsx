import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminOverview } from '@/components/admin/admin-overview';
import type {
  AdminDashboardSummary,
  DashboardOrder,
} from '@/components/admin/admin-overview';
import { selectCriticalStockProducts } from '@/lib/admin-stock-alerts';

export const metadata: Metadata = {
  title: 'Yönetim Genel Bakış | Öz Kırtasiye',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabase();
  // The admin product-search RPC already computes effective stock for variants.
  // Query both low/out states server-side instead of scanning an arbitrary first
  // 50 rows by products.stock_quantity (which is wrong for variant products).
  const [summaryResponse, ordersResponse, outResponse, lowResponse] = await Promise.all([
    supabase.rpc('admin_dashboard_summary', { p_days: 30 }),
    supabase
      .from('order_requests')
      .select('id,reference,status,created_at,total,delivery_method')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.rpc('admin_search_products', {
      p_visibility: 'active',
      p_stock: 'out',
      p_sort: 'stockAsc',
      p_page: 1,
    }),
    supabase.rpc('admin_search_products', {
      p_visibility: 'active',
      p_stock: 'low',
      p_sort: 'stockAsc',
      p_page: 1,
    }),
  ]);

  const criticalStock = selectCriticalStockProducts(outResponse.data, lowResponse.data);
  const lowStockProducts = criticalStock ?? [];

  const recentOrders: DashboardOrder[] = (ordersResponse.data ?? []).map((order) => ({
    id: order.id,
    reference: order.reference,
    status: order.status,
    createdAt: order.created_at,
    total: Number(order.total),
    deliveryMethod: order.delivery_method,
  }));

  const error =
    [
      summaryResponse.error,
      ordersResponse.error,
      outResponse.error,
      lowResponse.error,
    ]
      .filter((value) => Boolean(value))
      .map((value) => value?.message)
      .join(' · ') ||
    (criticalStock === null ? 'Kritik stok sonuçları doğrulanamadı.' : null);

  return (
    <AdminOverview
      summary={
        summaryResponse.error ? null : (summaryResponse.data as AdminDashboardSummary | null)
      }
      recentOrders={recentOrders}
      lowStockProducts={lowStockProducts}
      stockAlertsUnavailable={criticalStock === null || !!outResponse.error || !!lowResponse.error}
      loadError={error}
    />
  );
}
