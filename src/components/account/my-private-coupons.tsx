'use client';

import Link from 'next/link';
import { useClock } from '@/lib/use-clock';
import { BadgePercent, CalendarClock, Check, ShoppingBag, TicketPercent } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { formatPrice } from '@/lib/format';
import styles from './customer-coupons.module.css';

export type PrivateCoupon = {
  code: string;
  label: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  min_subtotal: number;
  expires_at: string | null;
  starts_at: string;
  is_active: boolean;
  max_uses: number | null;
  max_uses_per_customer: number;
  used_count: number;
  my_used_count: number;
};

export function MyPrivateCoupons({ coupons, loadError }: { coupons: PrivateCoupon[]; loadError: string | null }) {
  const { couponCode, setCouponCode } = useShop();
  const now = useClock();

  return (
    <section className={styles.section} aria-label="Bana özel kuponlarım">
      <div className={styles.heading}>
        <TicketPercent size={24} aria-hidden="true" />
        <h2>Bana özel kuponlarım</h2>
      </div>
      {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
      {!loadError && coupons.length === 0 && (
        <div className={styles.empty}>
          <strong>Şu anda hesabına atanmış özel kupon yok.</strong>
          <p>Yeni avantajların olduğunda burada görüntülenir. Genel kampanyalara da göz atabilirsin.</p>
          <Link href="/urunler">Ürünleri incele →</Link>
        </div>
      )}
      {!loadError && coupons.length > 0 && (
        <div className={styles.list}>
          {coupons.map((coupon) => {
            const expired = coupon.expires_at !== null && new Date(coupon.expires_at).getTime() <= now;
            const notStarted = new Date(coupon.starts_at).getTime() > now;
            const usageLimitReached = coupon.max_uses !== null && Number(coupon.used_count) >= coupon.max_uses;
            const personalLimitReached = Number(coupon.my_used_count) >= coupon.max_uses_per_customer;
            const available = coupon.is_active && !expired && !notStarted && !usageLimitReached && !personalLimitReached;
            const status = !coupon.is_active ? 'Pasif' : expired ? 'Süresi doldu' : notStarted ? 'Henüz başlamadı' : usageLimitReached ? 'Tükendi' : personalLimitReached ? 'Kullanım hakkın doldu' : 'Kullanılabilir';
            const selected = couponCode === coupon.code;
            return (
              <article key={coupon.code} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <strong className={styles.discount}>
                      {coupon.discount_type === 'percent'
                        ? `%${Number(coupon.discount_value).toLocaleString('tr-TR')} indirim`
                        : `${formatPrice(Number(coupon.discount_value))} indirim`}
                    </strong>
                    <p className={styles.couponLabel}>{coupon.label}</p>
                  </div>
                  <span className={styles.status} data-available={available}>{status}</span>
                </div>
                <div className={styles.meta}>
                  <span>
                    <BadgePercent size={15} aria-hidden="true" />
                    En az {formatPrice(Number(coupon.min_subtotal))} alışveriş
                  </span>
                  {coupon.max_discount !== null && coupon.discount_type === 'percent' && (
                    <span>En fazla {formatPrice(Number(coupon.max_discount))} indirim</span>
                  )}
                  <span>
                    <CalendarClock size={15} aria-hidden="true" />
                    {coupon.expires_at
                      ? `Son gün: ${new Date(coupon.expires_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}`
                      : 'Bitiş tarihi yok'}
                  </span>
                </div>
                <div className={styles.footer}>
                  <code className={styles.code}>{coupon.code}</code>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.apply}
                      disabled={!available || selected}
                      onClick={() => setCouponCode(coupon.code)}
                    >
                      {selected
                        ? <><Check size={16} aria-hidden="true" /> Sepete kaydedildi</>
                        : 'Sepette kullan'}
                    </button>
                    <Link href="/sepet" className={styles.goCart}>
                      <ShoppingBag size={16} aria-hidden="true" /> Sepete git
                    </Link>
                  </div>
                </div>
                <small className={styles.finePrint}>Kupon koşulları ve kullanım hakları sipariş sırasında yeniden doğrulanır.</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
