'use client';

import { useEffect, useState } from 'react';
import { BadgePercent, CheckCircle2, X } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { normalizeCouponCode, type CouponQuote } from '@/lib/coupon';
import { formatPrice } from '@/lib/format';
import styles from './coupon-box.module.css';

export function CouponBox({ quote, error, loading }: {
  quote: CouponQuote | null;
  error: string;
  loading: boolean;
}) {
  const { couponCode, setCouponCode } = useShop();
  const [draft, setDraft] = useState(couponCode);
  useEffect(() => setDraft(couponCode), [couponCode]);
  return (
    <section className={styles.container} aria-label="İndirim kuponu">
      <div className={styles.heading}><BadgePercent size={18}/><strong>İndirim kuponu</strong></div>
      <form className={styles.row} onSubmit={(event) => {
        event.preventDefault();
        const normalized = normalizeCouponCode(draft);
        if (/^[A-Z0-9_-]{4,32}$/.test(normalized)) setCouponCode(normalized);
      }}>
        <input aria-label="Kupon kodu" maxLength={32} autoCapitalize="characters" autoComplete="off"
          pattern="[A-Za-z0-9_-]{4,32}" value={draft} onChange={event=>setDraft(event.target.value)}
          placeholder="Örn. OZKIRTASIYE10" />
        <button className={styles.apply} disabled={loading} type="submit">{loading ? 'Kontrol...' : 'Uygula'}</button>
      </form>
      {quote?.campaignName && quote.discountAmount > 0 && <p className={styles.automatic} role="status"><CheckCircle2 size={15}/> Otomatik kampanya: <strong>{quote.campaignName}</strong> · −{formatPrice(quote.discountAmount)}</p>}
      {couponCode && <div className={styles.status}>
        {loading ? <small>Kupon sunucuda doğrulanıyor...</small>
          : error ? <small className={styles.error} role="alert">{error}</small>
          : quote ? (quote.code ? <small className={styles.ok}><CheckCircle2 size={14}/> {quote.code}: {formatPrice(quote.discountAmount)} indirim</small> : <small className={styles.ok}>Otomatik kampanya daha avantajlı; kupon kullanılmadı.</small>)
          : null}
        <button type="button" className={styles.clear} onClick={() => {setCouponCode('');setDraft('');}} aria-label="Kuponu kaldır">
          <X size={15}/> Kaldır
        </button>
      </div>}
      <small className={styles.hint}>İndirim ve kullanım hakkı sipariş gönderilirken yeniden doğrulanır. Kupon ödeme anlamına gelmez.</small>
    </section>
  );
}
