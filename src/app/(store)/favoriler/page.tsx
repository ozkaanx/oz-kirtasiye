import type { Metadata } from 'next';
import { getCachedLiveProducts } from '@/lib/cached-catalog';
import { LiveFavorites } from '@/components/product/live-favorites';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Favorilerim', robots: { index: false, follow: false } };

export default async function FavoritesPage() {
  return <LiveFavorites products={await getCachedLiveProducts()} />;
}
