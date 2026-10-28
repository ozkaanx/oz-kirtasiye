import Image from 'next/image';
import Link from 'next/link';
import { Package } from 'lucide-react';
import type { LiveProduct } from '@/lib/real-catalog';
import { LiveFavoriteButton } from './live-favorite-button';
import { CampaignPrice } from './campaign-price';
import { LivePurchaseButton } from './live-purchase-button';
import styles from './live-product-card.module.css';

export function LiveProductCard({ product }: { product: LiveProduct }) {
  return (
    <article className={styles.card}>
      <Link className={styles.content} href={`/magaza/urun/${product.slug}`}>
        <div className={styles.photo}>
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              width={520}
              height={650}
              sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 23vw"
            />
          ) : (
            <Package size={64} color="#b6bac1" aria-hidden="true" />
          )}
          {product.stock_quantity === 0 && <span className={styles.unavailable}>Tükendi</span>}
        </div>
        <div className={styles.information}>
          <h3 title={product.name}>{product.name}</h3>
          <CampaignPrice
            price={product.price}
            compareAtPrice={product.compare_at_price}
            promotion={product.promotion}
            campaignNotice={product.campaignNotice}
            compact
          />
        </div>
      </Link>
      <div className={styles.purchase}>
        {product.has_variants && product.stock_quantity > 0 ? (
          <Link className="button button-primary" href={`/magaza/urun/${product.slug}`}>
            Sepete ekle<span className={styles.srOnly}> — seçenekleri seç</span>
          </Link>
        ) : (
          <LivePurchaseButton productId={product.id} stock={product.stock_quantity} />
        )}
      </div>
      <div className={styles.favorite}>
        <LiveFavoriteButton productId={product.id} productName={product.name} />
      </div>
    </article>
  );
}
