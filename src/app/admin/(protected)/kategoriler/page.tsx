import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminCategories } from '@/components/admin/admin-categories';

export const metadata: Metadata = {
  title: 'Kategori Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const supabase = await createServerSupabase();
  const [{ data: categories, error: categoryError }, { data: products, error: productError }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id,parent_id,name,slug,description,image_path,sort_order,is_active')
        .order('sort_order', { ascending: true }),
      supabase.from('products').select('category_id').limit(2000),
    ]);

  const productCounts: Record<string, number> = {};
  (products ?? []).forEach((product) => {
    if (product.category_id) {
      productCounts[product.category_id] = (productCounts[product.category_id] ?? 0) + 1;
    }
  });

  return (
    <AdminCategories
      categories={categories ?? []}
      productCounts={productCounts}
      loadError={categoryError?.message ?? productError?.message ?? null}
    />
  );
}
