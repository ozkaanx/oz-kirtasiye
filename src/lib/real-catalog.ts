import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';

export type LiveProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  imageUrl: string | null;
};

export async function getLiveProducts(): Promise<LiveProduct[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(
      'id,slug,name,description,price,compare_at_price,stock_quantity,product_images(storage_path,sort_order)',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(16);
  if (error) {
    console.error('Katalog verileri okunamadı:', error.message);
    return [];
  }
  return (data ?? []).map((product) => {
    const sorted = (product.product_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const path = sorted[0]?.storage_path;
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      compare_at_price: product.compare_at_price == null ? null : Number(product.compare_at_price),
      stock_quantity: product.stock_quantity,
      imageUrl: path
        ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        : null,
    };
  });
}

export async function getLiveProductBySlug(slug: string): Promise<LiveProduct | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createServerSupabase();
  const { data: product, error } = await supabase
    .from('products')
    .select(
      'id,slug,name,description,price,compare_at_price,stock_quantity,product_images(storage_path,sort_order)',
    )
    .eq('is_active', true)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !product) return null;
  const path = product.product_images
    ?.slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    compare_at_price: product.compare_at_price == null ? null : Number(product.compare_at_price),
    stock_quantity: product.stock_quantity,
    imageUrl: path
      ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      : null,
  };
}
