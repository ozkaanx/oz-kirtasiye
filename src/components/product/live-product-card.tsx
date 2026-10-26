import Image from 'next/image';
import Link from 'next/link';
import { Package } from 'lucide-react';
import type { LiveProduct } from '@/lib/real-catalog';
import { LivePurchaseButton } from '@/components/product/live-purchase-button';
import { LiveFavoriteButton } from '@/components/product/live-favorite-button';
import { CampaignPrice } from './campaign-price';
import styles from './campaign-price.module.css';

export function LiveProductCard({ product }: { product: LiveProduct }) {
  return (
    <article className="product-card">
      <div className="product-photo">
        <Link href={`/magaza/urun/${product.slug}`} className="product-image-link" aria-label={`${product.name} ürün detayları`}>
          {product.imageUrl ? (
            <Image
              className="product-art" src={product.imageUrl} alt={product.name}
              width={520} height={540} sizes="(max-width: 550px) 46vw, (max-width: 1000px) 30vw, 23vw"
            />
          ) : (
            <Package size={72} color="#b8bbc3" />
          )}
        </Link>
        {product.stock_quantity === 0 ? (
          <span className="product-badge">TÜKENDİ</span>
        ) : product.promotion ? (
          <span className={styles.ribbon}>%{product.promotion.discountPercent} KAMPANYA</span>
        ) : product.is_featured ? (
          <span className="product-badge">ÖNE ÇIKAN</span>
        ) : null}
      </div>
      <div className="product-information">
        <Link href={`/magaza/urun/${product.slug}`} className="product-title">{product.name}</Link>
        <div className="product-buy-row">
          <div className="product-prices">
            <CampaignPrice
              price={product.price} compareAtPrice={product.compare_at_price}
              promotion={product.promotion} campaignNotice={product.campaignNotice}
            />
            <small className="live-stock">{product.stock_quantity > 0 ? `${product.stock_quantity} adet stokta` : 'Stokta yok'}</small>
          </div>
          <div className="live-card-actions">
            <LiveFavoriteButton productId={product.id} />
            <Link href={`/magaza/urun/${product.slug}`} className="live-view-link">İncele →</Link>
            {product.has_variants ? (
              <Link className="button button-primary" href={`/magaza/urun/${product.slug}`}>Seçenekleri gör</Link>
            ) : (
              <LivePurchaseButton productId={product.id} stock={product.stock_quantity} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
