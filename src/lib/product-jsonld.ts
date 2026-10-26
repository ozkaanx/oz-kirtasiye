import type { LiveProduct } from '@/lib/real-catalog';
import { absoluteStoreUrl, STORE_NAME } from '@/lib/seo';

function unitPrice(price: number, promotion: { discountedPrice: number } | null) {
  return promotion && promotion.discountedPrice >= 0 && promotion.discountedPrice < price
    ? promotion.discountedPrice : price;
}

/** Rich product information reflects the actual one-unit catalog price; never invent reviews. */
export function productJsonLd(product: LiveProduct): Record<string, unknown> | null {
  const url = absoluteStoreUrl(`/magaza/urun/${encodeURIComponent(product.slug)}`);
  if (!url) return null;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} | ${STORE_NAME}`,
    url,
    ...(product.galleryUrls.length || product.imageUrl
      ? { image: product.galleryUrls.length ? product.galleryUrls : [product.imageUrl] }
      : {}),
  };
  const seller = { '@type': 'Organization', name: STORE_NAME };
  if (product.has_variants && product.variants.length) {
    const available = product.variants.filter(v => v.is_active && v.stock_quantity > 0);
    const candidates = available.length ? available : product.variants.filter(v => v.is_active);
    const prices = candidates.map(v => unitPrice(v.price, v.promotion));
    if (prices.length) {
      data.offers = {
        '@type': 'AggregateOffer',
        priceCurrency: 'TRY',
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: candidates.length,
        availability: available.length ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller,
        url,
      };
    }
  } else {
    data.offers = {
      '@type': 'Offer',
      priceCurrency: 'TRY',
      price: unitPrice(product.price, product.promotion).toFixed(2),
      availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller,
      url,
    };
  }
  return data;
}

export function breadcrumbJsonLd(productName: string, slug: string): Record<string, unknown> | null {
  const root = absoluteStoreUrl('/');
  const catalog = absoluteStoreUrl('/urunler');
  const detail = absoluteStoreUrl(`/magaza/urun/${encodeURIComponent(slug)}`);
  if (!root || !catalog || !detail) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: root },
      { '@type': 'ListItem', position: 2, name: 'Tüm Ürünler', item: catalog },
      { '@type': 'ListItem', position: 3, name: productName, item: detail },
    ],
  };
}
