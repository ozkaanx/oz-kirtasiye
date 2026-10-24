import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminOverview } from '@/components/admin/admin-overview';
import type {
  AdminDashboardSummary,
  DashboardLowStock,
  DashboardOrder,
} from '@/components/admin/admin-overview';

export const metadata: Metadata = {
  title: 'Yönetim Genel Bakış | Öz Kırtasiye',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabase();
  const [summaryResponse, ordersResponse, stockResponse] = await Promise.all([
    supabase.rpc('admin_dashboard_summary', { p_days: 30 }),
    supabase
      .from('order_requests')
      .select('id,reference,status,created_at,total,delivery_method')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('products')
      .select('id,name,slug,stock_quantity,low_stock_threshold')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true })
      .limit(50),
  ]);

  const lowStockProducts: DashboardLowStock[] = (stockResponse.data ?? [])
    .filter((product) => product.stock_quantity <= product.low_stock_threshold)
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      stock: Number(product.stock_quantity),
      threshold: Number(product.low_stock_threshold),
    }));

  const recentOrders: DashboardOrder[] = (ordersResponse.data ?? []).map((order) => ({
    id: order.id,
    reference: order.reference,
    status: order.status,
    createdAt: order.created_at,
    total: Number(order.total),
    deliveryMethod: order.delivery_method,
  }));

  const error =
    [summaryResponse.error, ordersResponse.error, stockResponse.error]
      .filter((value) => Boolean(value))
      .map((value) => value?.message)
      .join(' · ') || null;

  return (
    <AdminOverview
      summary={
        summaryResponse.error ? null : (summaryResponse.data as AdminDashboardSummary | null)
      }
      recentOrders={recentOrders}
      lowStockProducts={lowStockProducts}
      loadError={error}
    />
  );
}
