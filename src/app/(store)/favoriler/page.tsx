import type { Metadata } from 'next';
import { LiveFavorites } from '@/components/product/live-favorites';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Favorilerim', robots: { index: false, follow: false } };

export default function FavoritesPage() {
  return <LiveFavorites />;
}
