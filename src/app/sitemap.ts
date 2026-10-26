import type { MetadataRoute } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { getCachedLiveCategories } from '@/lib/cached-catalog';
import { absoluteStoreUrl, isSeoPublic } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type SitemapProduct = { slug: string; updated_at: string | null };

/** Only enabled public products. Avoid the 500-product storefront limit. */
async function getSitemapProducts(): Promise<SitemapProduct[]> {
  const supabase = await createServerSupabase();
  const rows: SitemapProduct[] = [];
  const PAGE_SIZE = 500;
  const MAX_PRODUCTS = 20000;
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('products')
      .select('slug,updated_at')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('SEO sitemap ürün sorgusu başarısız:', error.message);
      // Do not publish a partial sitemap after a database failure.
      return [];
    }
    const batch = (data ?? []) as SitemapProduct[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSeoPublic() || !hasSupabaseConfig()) return [];
  const root = absoluteStoreUrl('/');
  if (!root) return [];
  const [categories, products] = await Promise.all([getCachedLiveCategories(), getSitemapProducts()]);
  const urls: MetadataRoute.Sitemap = [
    { url: root, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteStoreUrl('/urunler')!, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteStoreUrl('/hakkimizda')!, changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteStoreUrl('/iletisim')!, changeFrequency: 'monthly', priority: 0.4 },
  ];
  for (const category of categories) {
    const url = absoluteStoreUrl(`/urunler?category=${encodeURIComponent(category.slug)}`);
    if (url) urls.push({ url, changeFrequency: 'weekly', priority: 0.7 });
  }
  for (const product of products) {
    if (!product.slug) continue;
    const url = absoluteStoreUrl(`/magaza/urun/${encodeURIComponent(product.slug)}`);
    if (!url) continue;
    const date = product.updated_at ? new Date(product.updated_at) : null;
    urls.push({
      url,
      ...(date && Number.isFinite(date.getTime()) ? { lastModified: date } : {}),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }
  return urls;
}
