import Link from 'next/link';
import { Package } from 'lucide-react';
import type { LiveProduct } from '@/lib/real-catalog';
import { formatPrice } from '@/lib/format';

export function LiveProductCard({ product }: { product: LiveProduct }) {
  return (
    <article className="product-card">
      <div className="product-photo">
        <Link
          href={`/magaza/urun/${product.slug}`}
          className="product-image-link"
          aria-label={`${product.name} ürün detayları`}
        >
          {product.imageUrl ? (
            <img className="product-art" src={product.imageUrl} alt={product.name} loading="lazy" />
          ) : (
            <Package size={72} color="#b8bbc3" />
          )}
        </Link>
        {product.stock_quantity === 0 ? (
          <span className="product-badge">TÜKENDİ</span>
        ) : product.is_featured ? (
          <span className="product-badge">ÖNE ÇIKAN</span>
        ) : null}
      </div>
      <div className="product-information">
        <Link href={`/magaza/urun/${product.slug}`} className="product-title">
          {product.name}
        </Link>
        <div className="product-buy-row">
          <div className="product-prices">
            {product.compare_at_price !== null && product.compare_at_price > product.price && (
              <span className="old-price">{formatPrice(product.compare_at_price)}</span>
            )}
            <strong className="current-price">{formatPrice(product.price)}</strong>
            <small className="live-stock">
              {product.stock_quantity > 0 ? `${product.stock_quantity} adet stokta` : 'Stokta yok'}
            </small>
          </div>
          <Link href={`/magaza/urun/${product.slug}`} className="live-view-link">
            İncele →
          </Link>
        </div>
      </div>
    </article>
  );
}
