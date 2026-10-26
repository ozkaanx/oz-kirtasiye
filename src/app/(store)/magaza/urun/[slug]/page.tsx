import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { getLiveProductBySlug } from '@/lib/real-catalog';
import { LivePurchaseButton } from '@/components/product/live-purchase-button';
import { LiveVariantPicker } from '@/components/product/live-variant-picker';
import { LiveFavoriteButton } from '@/components/product/live-favorite-button';
import { CampaignPrice } from '@/components/product/campaign-price';

export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getLiveProductBySlug(slug);
  return {
    title: product?.name ?? 'Ürün bulunamadı',
    description: product?.description ?? undefined,
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
  const product = await getLiveProductBySlug(slug);
  if (!product) notFound();
  return (
    <main className="container-wide">
      <div className="breadcrumbs">
        <Link href="/urunler">
          <ArrowLeft size={15} /> Ürünlere geri dön
        </Link>
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
          <p className="real-no-checkout">
            Online ödeme henüz aktif değil; sipariş talebi oluşturabilirsiniz.
          </p>
        </section>
      ) : (
        <section className="real-detail-card">
          <div className="real-detail-photo">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} />
            ) : (
              <Package size={100} color="#bcc0c9" />
            )}
          </div>
          <div className="real-detail-info">
            <span className="section-eyebrow">ÖZ KIRTASİYE</span>
            <h1>
              {product.name}
              <span className="orange-dot">.</span>
            </h1>
            <CampaignPrice
              price={product.price}
              compareAtPrice={product.compare_at_price}
              promotion={product.promotion}
              campaignNotice={product.campaignNotice}
              size="detail"
            />
            <p>{product.description ?? 'Ürün detayları yakında eklenecek.'}</p>
            <p>
              <strong>
                {product.stock_quantity > 0
                  ? `${product.stock_quantity} adet stokta`
                  : 'Stokta yok'}
              </strong>
            </p>
            <p className="real-no-checkout">
              Online ödeme henüz aktif değil. Sepete ekleyip sipariş talebi gönderebilirsiniz.
            </p>
            <LivePurchaseButton productId={product.id} stock={product.stock_quantity} detail />
            <LiveFavoriteButton productId={product.id} />
          </div>
        </section>
      )}
    </main>
  );
}
