import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { getLiveCategories, getLiveProducts } from '@/lib/real-catalog';

export const metadata: Metadata = { title: 'Tüm Ürünler' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const [liveProducts, categories] = await Promise.all([getLiveProducts(), getLiveCategories()]);
  return (
    <CatalogView
      key={`${params.category ?? 'all'}-${params.q ?? ''}`}
      initialCategory={params.category ?? 'all'}
      initialSearch={params.q ?? ''}
      liveProducts={liveProducts}
      categories={categories}
    />
  );
}
