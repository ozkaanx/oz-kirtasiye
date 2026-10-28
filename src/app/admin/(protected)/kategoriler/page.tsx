import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminCategories } from '@/components/admin/admin-categories';
import type { CategoryCatalog } from '@/lib/admin-customer-catalog';
import { operationTrace } from '@/lib/operation-trace';
export const metadata: Metadata = {
  title: 'Kategori Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function AdminCategoriesPage() {
  const trace = operationTrace('admin_category_catalog');
  let result: CategoryCatalog | null = null;
  let loadError: string | null = null;
  try {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc('admin_category_catalog');
    if (error || !data || !Array.isArray(data.categories) || !data.productCounts) {
      trace.error(error ? 'database_error' : 'empty_result', error?.code);
      loadError = 'Kategoriler yüklenemedi. Tekrar deneyin. Takip kodu: ' + trace.requestId;
    } else result = data as CategoryCatalog;
  } catch {
    trace.error('unexpected');
    loadError = 'Kategori servisine ulaşılamadı. Takip kodu: ' + trace.requestId;
  }
  return (
    <AdminCategories
      categories={result?.categories ?? []}
      productCounts={result?.productCounts ?? null}
      loadError={loadError}
    />
  );
}
