import { formatPrice } from '@/lib/format';
import { BadgePercent } from 'lucide-react';
import type { CatalogCampaignNotice, CatalogPromotion } from '@/lib/real-catalog';
import styles from './campaign-price.module.css';

export function CampaignPrice({
  price,
  compareAtPrice,
  promotion,
  campaignNotice,
  size = 'card',
}: {
  price: number;
  compareAtPrice: number | null;
  promotion: CatalogPromotion | null;
  campaignNotice?: CatalogCampaignNotice | null;
  size?: 'card' | 'detail';
}) {
  const activePromotion = promotion && promotion.discountedPrice < price ? promotion : null;
  return (
    <div className={`${styles.price} ${size === 'detail' ? styles.detail : ''}`}>
      {activePromotion ? (
        <>
          <div className={styles.mainRow}>
            <del className={styles.old}>{formatPrice(price)}</del>
            <strong className={styles.discounted}>
              {formatPrice(activePromotion.discountedPrice)}
            </strong>
          </div>
          <span className={styles.saving}>
            %{activePromotion.discountPercent} indirim ·{' '}
            {formatPrice(activePromotion.discountAmount)} avantaj
          </span>
          <span className={styles.note}>
            {activePromotion.campaignName} · Sepette tek ürün için geçerli
          </span>
        </>
      ) : (
        <>
          {compareAtPrice != null && compareAtPrice > price && (
            <del className={styles.old}>{formatPrice(compareAtPrice)}</del>
          )}
          <strong className={styles.regular}>{formatPrice(price)}</strong>
        </>
      )}
      {!activePromotion && campaignNotice && (
        <div className={styles.basketCondition} role="note">
          <BadgePercent size={size === 'detail' ? 17 : 14} aria-hidden="true" />
          <span>
            <strong>{formatPrice(campaignNotice.minSubtotal)} ve üzeri sepette</strong>{' '}
            {campaignNotice.discountType === 'percent'
              ? `%${campaignNotice.discountValue.toLocaleString('tr-TR')}${campaignNotice.maxDiscount != null ? "'e varan" : ''} indirim fırsatı`
              : `${formatPrice(campaignNotice.discountValue)}'ye kadar indirim fırsatı`}
            {size === 'detail' && (
              <small>
                {campaignNotice.campaignName} · Koşullar sağlandığında indirim sepette hesaplanır.
              </small>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
