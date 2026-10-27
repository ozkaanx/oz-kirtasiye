import type { Metadata } from 'next';
import Link from 'next/link';
import { StoreProductDetail } from '@/components/product/store-product-detail';
import { getStoreSettings } from '@/lib/store-settings';
import { getCachedLiveCategories } from '@/lib/cached-catalog';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getCachedLiveProductBySlug } from '@/lib/cached-catalog';
import { absoluteStoreUrl, isSeoPublic, safeJsonLd, seoDescription } from '@/lib/seo';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/product-jsonld';
import { getProductRecommendations } from '@/lib/product-recommendations';
import { RecommendationSection } from '@/components/product/recommendation-section';
import { ProductReviews } from '@/components/product/product-reviews';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedLiveProductBySlug(slug);
  if (!product) return { title: 'Ürün bulunamadı', robots: { index: false, follow: false } };
  const description = seoDescription(
    product.description,
    `${product.name} - Öz Kırtasiye'de keşfet.`,
  );
  const canonical = `/magaza/urun/${encodeURIComponent(product.slug)}`;
  const image = product.imageUrl ? [product.imageUrl] : [];
  return {
    title: product.name,
    description,
    robots: { index: isSeoPublic(), follow: isSeoPublic() },
    ...(absoluteStoreUrl(canonical) ? { alternates: { canonical } } : {}),
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      ...(image.length ? { images: image } : {}),
    },
    twitter: { card: 'summary_large_image', ...(image.length ? { images: image } : {}) },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { slug } = await params;
  const { variant } = await searchParams;
  const product = await getCachedLiveProductBySlug(slug);
  if (!product) notFound();
  const [relatedProducts, settings, categories] = await Promise.all([
    getProductRecommendations([product.id], 4),
    getStoreSettings(),
    getCachedLiveCategories(),
  ]);
  const category = categories.find((item) => item.id === product.category_id);
  const reviewDb = await createServerSupabase();
  const { data: reviewRows } = await reviewDb
    .from('product_reviews')
    .select('id,rating,body,created_at')
    .eq('product_id', product.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50);
  let access: 'guest' | 'eligible' | 'ineligible' | 'unavailable' = 'unavailable';
  try {
    const { data: auth, error: authError } = await reviewDb.auth.getUser();
    if (!auth.user && (!authError || authError.name === 'AuthSessionMissingError'))
      access = 'guest';
    else if (auth.user && !authError) {
      const ownership = await reviewDb
        .from('order_requests')
        .select('id,order_request_items!inner(product_id)')
        .eq('customer_user_id', auth.user.id)
        .in('status', ['delivered', 'completed'])
        .eq('order_request_items.product_id', product.id)
        .limit(1);
      if (!ownership.error) access = ownership.data?.length ? 'eligible' : 'ineligible';
    }
  } catch {
    /* Keep the form closed when ownership cannot be verified. */
  }
  const reviews = reviewRows ?? [];
  const reviewAverage = reviews.length
    ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
    : 0;
  const jsonLd = isSeoPublic()
    ? [productJsonLd(product), breadcrumbJsonLd(product.name, product.slug)].filter(
        (entry): entry is Record<string, unknown> => entry !== null,
      )
    : [];
  return (
    <div className="container-wide">
      {jsonLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({ '@context': 'https://schema.org', '@graph': jsonLd }),
          }}
        />
      )}
      <nav className="breadcrumbs" aria-label="İçerik yolu">
        <Link href="/">Ana sayfa</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link
          href={category ? '/urunler?category=' + encodeURIComponent(category.slug) : '/urunler'}
        >
          {category?.name ?? 'Ürünler'}
        </Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span>{product.name}</span>
      </nav>
      <StoreProductDetail
        product={product}
        settings={settings}
        initialVariantId={typeof variant === 'string' ? variant : undefined}
      />
      <ProductReviews
        access={access}
        productSlug={product.slug}
        productId={product.id}
        reviews={reviews}
        average={reviewAverage}
      />
      <RecommendationSection title="Benzer ürünler" products={relatedProducts} />
    </div>
  );
}
