import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminProducts } from '@/components/admin/admin-products';

export const metadata: Metadata = {
  title: 'Ürün ve Stok Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createServerSupabase();
  const [
    { data: products, error: productError },
    { data: categories, error: categoryError },
    { data: movements },
  ] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id,name,slug,description,category_id,sku,price,compare_at_price,stock_quantity,low_stock_threshold,has_variants,is_active,is_featured,product_variants(id,stock_quantity,price,is_active),product_images(storage_path,sort_order)',
      )
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('categories')
      .select('id,parent_id,name,slug,description,image_path,sort_order,is_active')
      .order('sort_order'),
    supabase
      .from('stock_movements')
      .select('id,product_id,change_quantity,quantity_after,created_at,note,reason')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  const withImages = (products ?? []).map((p) => {
    const path = p.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    const activeVariants = (p.product_variants ?? []).filter((v) => v.is_active);
    return {
      ...p,
      stock_quantity: p.has_variants
        ? activeVariants.reduce((sum, v) => sum + v.stock_quantity, 0)
        : p.stock_quantity,
      price:
        p.has_variants && activeVariants.length
          ? Math.min(
              ...(activeVariants.some((v) => v.stock_quantity > 0)
                ? activeVariants.filter((v) => v.stock_quantity > 0)
                : activeVariants
              ).map((v) => Number(v.price)),
            )
          : Number(p.price),
      imageUrl: path
        ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        : null,
    };
  });
  return (
    <AdminProducts
      products={withImages}
      categories={categories ?? []}
      movements={movements ?? []}
      loadError={productError?.message ?? categoryError?.message ?? null}
    />
  );
}
