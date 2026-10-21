import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import type { StoreCategory } from '@/lib/category-utils';
import { flattenCategories } from '@/lib/category-utils';

export type LiveProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
  imageUrl: string | null;
};

const PRODUCT_FIELDS =
  'id,slug,name,description,category_id,price,compare_at_price,stock_quantity,is_featured,created_at,product_images(storage_path,sort_order)';

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
  product_images: { storage_path: string; sort_order: number }[] | null;
};

async function transformRows(rows: ProductRow[]) {
  const supabase = await createServerSupabase();
  return rows.map((product): LiveProduct => {
    const path = product.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      price: Number(product.price),
      compare_at_price: product.compare_at_price == null ? null : Number(product.compare_at_price),
      stock_quantity: product.stock_quantity,
      is_featured: product.is_featured,
      created_at: product.created_at,
      imageUrl: path
        ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        : null,
    };
  });
}

/** The catalogue is intentionally capped for this MVP. Add server pagination above 500 products. */
export async function getLiveProducts(): Promise<LiveProduct[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('Katalog verileri okunamadı:', error.message);
    return [];
  }
  return transformRows((data ?? []) as ProductRow[]);
}

export async function getLiveProductBySlug(slug: string): Promise<LiveProduct | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return (await transformRows([data as ProductRow]))[0];
}

export async function getLiveCategories(): Promise<StoreCategory[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('categories')
    .select('id,parent_id,name,slug,description,image_path,sort_order,is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('Kategoriler okunamadı:', error.message);
    return [];
  }
  const all = (data ?? []) as StoreCategory[];
  // Hide descendants of disabled parents from the public navigation.
  const visibleIds = new Set<string>();
  const { length } = all;
  for (let pass = 0; pass < length + 1; pass++) {
    all.forEach((cat) => {
      if (!cat.parent_id || visibleIds.has(cat.parent_id)) visibleIds.add(cat.id);
    });
  }
  return flattenCategories(all.filter((cat) => visibleIds.has(cat.id))).map(
    (entry) => entry.category,
  );
}
