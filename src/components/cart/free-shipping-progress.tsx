'use client';

import Link from 'next/link';
import { CheckCircle2, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import styles from './free-shipping-progress.module.css';

type Props = {
  subtotal: number;
  threshold: number | null;
  shippingAvailable: boolean;
  shippingFee: number | null;
};

/** An estimate only. Checkout recalculates shipping and campaign discounts. */
export function FreeShippingProgress({ subtotal, threshold, shippingAvailable, shippingFee }: Props) {
  if (!shippingAvailable || threshold === null || !Number.isFinite(threshold) || threshold <= 0) {
    return null;
  }

  const safeSubtotal = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  const remaining = Math.max(0, Math.round((threshold - safeSubtotal) * 100) / 100);
  const percent = Math.min(100, Math.max(0, (safeSubtotal / threshold) * 100));
  const achieved = remaining === 0;

  return (
    <section className={styles.card} aria-label="Ücretsiz kargo hedefi">
      <div className={styles.message} role="status">
        {achieved ? <CheckCircle2 size={19} aria-hidden="true" /> : <Truck size={19} aria-hidden="true" />}
        <span>
          {achieved ? 'Ücretsiz kargo hedefine ulaştın!' : (
            <>Ücretsiz kargoya <strong>{formatPrice(remaining)}</strong> kaldı.</>
          )}
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Ücretsiz kargo hedefine ilerleme"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.meta}>
        <span>{formatPrice(safeSubtotal)}</span>
        <span>Hedef: {formatPrice(threshold)}</span>
      </div>
      {!achieved && (
        <Link href="/urunler" className={styles.link}>
          Hedefe yaklaşmak için ürünleri keşfet →
        </Link>
      )}
      {achieved && shippingFee === 0 && <p className={styles.note}>Tahmini kargo ücreti: ücretsiz</p>}
      <p className={styles.note}>Bu bilgi ürün ara toplamına göre tahminidir. Kampanyalar ve kesin teslimat tutarı sipariş aşamasında doğrulanır.</p>
    </section>
  );
}
