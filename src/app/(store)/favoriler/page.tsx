import type { Metadata } from 'next';
import { getLiveProducts } from '@/lib/real-catalog';
import { LiveFavorites } from '@/components/product/live-favorites';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Favorilerim' };

export default async function FavoritesPage() {
  return <LiveFavorites products={await getLiveProducts()} />;
}
