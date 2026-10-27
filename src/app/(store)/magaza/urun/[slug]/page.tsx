import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { getCachedLiveProductBySlug } from '@/lib/cached-catalog';
import { absoluteStoreUrl, isSeoPublic, safeJsonLd, seoDescription } from '@/lib/seo';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/product-jsonld';
import { LivePurchaseButton } from '@/components/product/live-purchase-button';
import { LiveVariantPicker } from '@/components/product/live-variant-picker';
import { LiveFavoriteButton } from '@/components/product/live-favorite-button';
import { CampaignPrice } from '@/components/product/campaign-price';
import { getProductRecommendations } from '@/lib/product-recommendations';
import { RecommendationSection } from '@/components/product/recommendation-section';
import { ProductReviews } from '@/components/product/product-reviews';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedLiveProductBySlug(slug);
  if (!product) return { title: 'Ürün bulunamadı', robots: { index: false, follow: false } };
  const description = seoDescription(product.description, `${product.name} - Öz Kırtasiye'de keşfet.`);
  const canonical = `/magaza/urun/${encodeURIComponent(product.slug)}`;
  const image = product.imageUrl ? [product.imageUrl] : [];
  return {
    title: product.name,
    description,
    robots: { index: isSeoPublic(), follow: isSeoPublic() },
    ...(absoluteStoreUrl(canonical) ? { alternates: { canonical } } : {}),
    openGraph: {
      type: 'website', title: product.name, description,
      ...(image.length ? { images: image } : {}),
    },
    twitter: { card: 'summary_large_image', ...(image.length ? { images: image } : {}) },
  };
}

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { slug } = await params;
  const { variant } = await searchParams;
  const product = await getCachedLiveProductBySlug(slug);
  if (!product) notFound();
  const relatedProducts = await getProductRecommendations([product.id], 4);
  const reviewDb = await createServerSupabase();
  const { data: reviewRows } = await reviewDb.from('product_reviews').select('id,rating,body,created_at').eq('product_id', product.id).eq('status','approved').order('created_at', {ascending:false}).limit(50);
  const reviews = reviewRows ?? [];
  const reviewAverage = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : 0;
  const jsonLd = isSeoPublic() ? [
    productJsonLd(product), breadcrumbJsonLd(product.name, product.slug),
  ].filter((entry): entry is Record<string, unknown> => entry !== null) : [];
  return (
    <div className="container-wide">
      {jsonLd.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ '@context': 'https://schema.org', '@graph': jsonLd }) }} />
      )}
      <div className="breadcrumbs">
        <Link href="/urunler"><ArrowLeft size={15} /> Ürünlere geri dön</Link>
      </div>
      {product.has_variants ? (
        <section className="variant-detail-page">
          <LiveVariantPicker
            key={typeof variant === 'string' ? variant : product.id}
            productId={product.id}
            name={product.name}
            description={product.description}
            variants={product.variants}
            initialVariantId={typeof variant === 'string' ? variant : undefined}
            imageUrl={product.imageUrl}
            galleryUrls={product.galleryUrls}
          />
          <p className="real-no-checkout">Online ödeme henüz aktif değil; sipariş talebi oluşturabilirsiniz.</p>
        </section>
      ) : (
        <section className="real-detail-card">
          <div className="real-detail-photo">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl} alt={product.name}
                width={900} height={900} priority
                sizes="(max-width: 700px) 100vw, 48vw"
              />
            ) : (
              <Package size={100} color="#bcc0c9" />
            )}
          </div>
          <div className="real-detail-info">
            <span className="section-eyebrow">ÖZ KIRTASİYE</span>
            <h1>{product.name}<span className="orange-dot">.</span></h1>
            <CampaignPrice
              price={product.price} compareAtPrice={product.compare_at_price}
              promotion={product.promotion} campaignNotice={product.campaignNotice} size="detail"
            />
            <p>{product.description ?? 'Ürün detayları yakında eklenecek.'}</p>
            <p><strong>{product.stock_quantity > 0 ? `${product.stock_quantity} adet stokta` : 'Stokta yok'}</strong></p>
            <p className="real-no-checkout">Online ödeme henüz aktif değil. Sepete ekleyip sipariş talebi gönderebilirsiniz.</p>
            <LivePurchaseButton productId={product.id} stock={product.stock_quantity} detail />
            <LiveFavoriteButton productId={product.id} />
          </div>
        </section>
      )}
      <ProductReviews productId={product.id} reviews={reviews} average={reviewAverage} />
      <RecommendationSection title="Benzer ürünler" products={relatedProducts} />
    </div>
  );
}
