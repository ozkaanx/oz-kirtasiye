import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { getCachedLiveCategories, getCachedLiveProducts } from '@/lib/cached-catalog';
import { parseCatalogFilters, serializeCatalogFilters } from '@/lib/catalog-filters';
import { absoluteStoreUrl, isSeoPublic, seoDescription } from '@/lib/seo';

type Query = Record<string, string | string[] | undefined>;
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  const raw = await searchParams;
  const slug = typeof raw.category === 'string' ? raw.category : '';
  const categories = slug && slug !== 'all' ? await getCachedLiveCategories() : [];
  const category = categories.find(item => item.slug === slug);
  const refined = Object.keys(raw).some(key => key !== 'category') || Array.isArray(raw.category);
  const index = isSeoPublic() && !refined && (!slug || slug === 'all' || !!category);
  const canonical = category ? `/urunler?category=${encodeURIComponent(category.slug)}` : '/urunler';
  const title = category ? `${category.name} Ürünleri` : 'Tüm Ürünler';
  const description = category
    ? seoDescription(category.description, `${category.name} seçeneklerini Öz Kırtasiye'de keşfedin.`)
    : 'Kırtasiye, oyuncak, okul ve hobi ürünlerini keşfet. Fiyat, renk ve özelliklere göre filtrele.';
  return {
    title, description,
    robots: { index, follow: index },
    ...(absoluteStoreUrl(canonical) ? { alternates: { canonical } } : {}),
    openGraph: { title, description, type: 'website' },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach(entry => params.append(key, entry));
    else if (typeof value === 'string') params.set(key, value);
  }
  const initialFilters = parseCatalogFilters(params);
  const [liveProducts, categories] = await Promise.all([getCachedLiveProducts(), getCachedLiveCategories()]);
  return (
    <CatalogView
      key={serializeCatalogFilters(initialFilters)}
      initialFilters={initialFilters}
      liveProducts={liveProducts}
      categories={categories}
    />
  );
}
