import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { getLiveCategories, getLiveProducts } from '@/lib/real-catalog';
import { parseCatalogFilters, serializeCatalogFilters } from '@/lib/catalog-filters';

export const metadata: Metadata = { title: 'Tüm Ürünler' };
export const dynamic = 'force-dynamic';

type Query = Record<string, string | string[] | undefined>;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (typeof value === 'string') params.set(key, value);
  }
  const initialFilters = parseCatalogFilters(params);
  const [liveProducts, categories] = await Promise.all([getLiveProducts(), getLiveCategories()]);

  return (
    <CatalogView
      key={serializeCatalogFilters(initialFilters)}
      initialFilters={initialFilters}
      liveProducts={liveProducts}
      categories={categories}
    />
  );
}
