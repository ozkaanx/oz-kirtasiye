import { HomeStorefront } from '@/components/home/home-storefront';
import { getLiveCategories, getLiveProducts } from '@/lib/real-catalog';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [liveProducts, categories] = await Promise.all([getLiveProducts(), getLiveCategories()]);
  return <HomeStorefront liveProducts={liveProducts} categories={categories} />;
}
