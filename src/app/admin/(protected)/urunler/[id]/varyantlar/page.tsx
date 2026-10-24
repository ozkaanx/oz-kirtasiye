import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminVariants } from '@/components/admin/admin-variants';

export const metadata: Metadata = {
  title: 'Ürün Varyantları',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

function errorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('message' in value)) return null;
  return typeof value.message === 'string' ? value.message : null;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const [{ data: product, error: productError }, { data: variants, error: variantError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id,name,has_variants,stock_quantity,price')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('product_variants')
        .select(
          'id,product_id,sku,color,size,price,compare_at_price,stock_quantity,low_stock_threshold,image_path,is_active,sort_order',
        )
        .eq('product_id', id)
        .order('sort_order', { ascending: true }),
    ]);
  if (!product) notFound();
  const variantsWithImages = (variants ?? []).map((v) => ({
    ...v,
    price: Number(v.price),
    compare_at_price: v.compare_at_price == null ? null : Number(v.compare_at_price),
    imageUrl: v.image_path
      ? supabase.storage.from('product-images').getPublicUrl(v.image_path).data.publicUrl
      : null,
  }));
  const ids = variantsWithImages.map((v) => v.id);
  const { data: movements } = ids.length
    ? await supabase
        .from('variant_stock_movements')
        .select('id,variant_id,quantity_before,change_quantity,quantity_after,note,created_at')
        .in('variant_id', ids)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] };
  return (
    <AdminVariants
      product={product}
      variants={variantsWithImages}
      movements={movements ?? []}
      loadError={errorMessage(productError) ?? errorMessage(variantError)}
    />
  );
}
