import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { PRODUCT_FIELDS, transformRows, type LiveProduct, type ProductRow } from '@/lib/real-catalog';

/** Related items are selected only from active products in the same categories. */
export async function getProductRecommendations(ids: string[], limit = 8): Promise<LiveProduct[]> {
  if (!hasSupabaseConfig() || ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)].slice(0, 20);
  const db = await createServerSupabase();
  const { data: sources, error: sourceError } = await db.from('products')
    .select('id,category_id').in('id', uniqueIds).eq('is_active', true);
  if (sourceError || !sources?.length) return [];
  const categoryIds = [...new Set(sources.map((item) => item.category_id).filter((id): id is string => Boolean(id)))];
  if (categoryIds.length === 0) return [];
  const { data, error } = await db.from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .in('category_id', categoryIds)
    .not('id', 'in', `(${uniqueIds.join(',')})`)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 12));
  if (error) {
    console.error('Ürün önerileri okunamadı:', error.message);
    return [];
  }
  return transformRows((data ?? []) as ProductRow[]);
}
