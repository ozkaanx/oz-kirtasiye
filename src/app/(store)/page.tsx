import type { Metadata } from 'next';
import { HomeStorefront } from '@/components/home/home-storefront';
import { getCachedLiveCategories } from '@/lib/cached-catalog';
import { getHomeCatalog } from '@/lib/home-catalog';
import { absoluteStoreUrl, isSeoPublic, safeJsonLd, STORE_DESCRIPTION } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  description: STORE_DESCRIPTION,
  ...(absoluteStoreUrl('/') ? { alternates: { canonical: '/' } } : {}),
};

export default async function HomePage() {
  const categories = await getCachedLiveCategories();
  const { featuredByCategory, newestProducts } = await getHomeCatalog(categories);
  const website = absoluteStoreUrl('/');
  const storeSchema = website && isSeoPublic() ? {
    '@context': 'https://schema.org', '@type': 'Store',
    '@id': `${website}#store`, name: 'Öz Kırtasiye', url: website,
    description: STORE_DESCRIPTION,
    address: {
      '@type': 'PostalAddress', addressLocality: 'Bağcılar',
      addressRegion: 'İstanbul', addressCountry: 'TR',
    },
  } : null;
  return (
    <>
      {storeSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(storeSchema) }} />}
      <HomeStorefront featuredByCategory={featuredByCategory} newestProducts={newestProducts} categories={categories} />
    </>
  );
}
