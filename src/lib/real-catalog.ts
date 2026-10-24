import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import type { StoreCategory } from '@/lib/category-utils';
import { flattenCategories } from '@/lib/category-utils';

export type LiveVariant = {
  id: string;
  color: string;
  size: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  imageUrl: string | null;
  is_active: boolean;
};

export type LiveProduct = {
  has_variants: boolean;
  variants: LiveVariant[];
  galleryUrls: string[];
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
  'id,slug,name,description,category_id,price,compare_at_price,stock_quantity,has_variants,is_featured,created_at,product_images(storage_path,sort_order),product_variants(id,color,size,price,compare_at_price,stock_quantity,image_path,is_active,sort_order)';

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
  has_variants: boolean;
  product_variants:
    | {
        id: string;
        color: string;
        size: string;
        price: string | number;
        compare_at_price: number | string | null;
        stock_quantity: number;
        image_path: string | null;
        is_active: boolean;
        sort_order: number;
      }[]
    | null;
};

async function transformRows(rows: ProductRow[]) {
  const supabase = await createServerSupabase();
  return rows.map((product): LiveProduct => {
    const path = product.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    const galleryUrls = (product.product_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (photo) =>
          supabase.storage.from('product-images').getPublicUrl(photo.storage_path).data.publicUrl,
      );
    const variants: LiveVariant[] = (product.product_variants ?? [])
      .filter((variant) => variant.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => ({
        id: variant.id,
        color: variant.color,
        size: variant.size,
        price: Number(variant.price),
        compare_at_price:
          variant.compare_at_price == null ? null : Number(variant.compare_at_price),
        stock_quantity: variant.stock_quantity,
        is_active: variant.is_active,
        imageUrl: variant.image_path
          ? supabase.storage.from('product-images').getPublicUrl(variant.image_path).data.publicUrl
          : null,
      }));
    const available = variants.filter((variant) => variant.stock_quantity > 0);
    const firstAvailable = available[0] ?? variants[0];
    return {
      has_variants: product.has_variants,
      variants,
      galleryUrls,
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      price: product.has_variants
        ? variants.length
          ? Math.min(...(available.length ? available : variants).map((v) => v.price))
          : Number(product.price)
        : Number(product.price),
      compare_at_price: product.has_variants
        ? null
        : product.compare_at_price == null
          ? null
          : Number(product.compare_at_price),
      stock_quantity: product.has_variants
        ? variants.reduce((sum, v) => sum + v.stock_quantity, 0)
        : product.stock_quantity,
      is_featured: product.is_featured,
      created_at: product.created_at,
      imageUrl:
        firstAvailable?.imageUrl ??
        (path ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl : null),
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
