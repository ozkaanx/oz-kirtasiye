'use client';

import Link from 'next/link';
import { useClock } from '@/lib/use-clock';
import { BadgePercent, CalendarClock, Check, ShoppingBag, TicketPercent } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { formatPrice } from '@/lib/format';

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
    <section style={{ marginBottom: 24 }} aria-label="Bana özel kuponlarım">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <TicketPercent size={23} color="#e85c35" aria-hidden="true" />
        <h2 style={{ margin: 0, fontSize: 22 }}>Bana Özel Kuponlarım</h2>
      </div>
      {loadError && <p role="alert" style={{ color: '#a63727' }}>{loadError}</p>}
      {!loadError && coupons.length === 0 && (
        <div style={{ padding: 22, border: '1px dashed #d9dde3', borderRadius: 14, background: '#fff' }}>
          <strong>Şu anda hesabına atanmış özel kupon yok.</strong>
          <p style={{ color: '#6d7681', lineHeight: 1.6, fontSize: 13 }}>Yeni avantajların olduğunda burada görüntülenir. Genel kampanyalara göz atabilirsin.</p>
          <Link href="/urunler" style={{ color: '#da572f', fontWeight: 700 }}>Ürünleri incele →</Link>
        </div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {coupons.map((coupon) => {
          const expired = coupon.expires_at !== null && new Date(coupon.expires_at).getTime() <= now;
          const notStarted = new Date(coupon.starts_at).getTime() > now;
          const usageLimitReached = coupon.max_uses !== null && Number(coupon.used_count) >= coupon.max_uses;
          const personalLimitReached = Number(coupon.my_used_count) >= coupon.max_uses_per_customer;
          const available = coupon.is_active && !expired && !notStarted && !usageLimitReached && !personalLimitReached;
          const status = !coupon.is_active ? 'Pasif' : expired ? 'Süresi doldu' : notStarted ? 'Henüz başlamadı' : usageLimitReached ? 'Tükendi' : personalLimitReached ? 'Kullanım hakkın doldu' : 'Kullanılabilir';
          const selected = couponCode === coupon.code;
          return (
            <article key={coupon.code} style={{ padding: 20, border: '1px solid #e4e6eb', background: '#fff', borderRadius: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: 20, color: '#20242a' }}>
                    {coupon.discount_type === 'percent' ? `%${Number(coupon.discount_value).toLocaleString('tr-TR')} indirim` : `${formatPrice(Number(coupon.discount_value))} indirim`}
                  </strong>
                  <p style={{ margin: '5px 0 0', color: '#626a75', fontSize: 13 }}>{coupon.label}</p>
                </div>
                <span style={{ alignSelf: 'start', borderRadius: 30, padding: '6px 12px', fontSize: 12, fontWeight: 750, background: available ? '#e9f6ee' : '#f1f2f4', color: available ? '#217047' : '#646c75' }}>{status}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#626a75' }}>
                <span><BadgePercent size={15} style={{ verticalAlign: 'middle' }} /> En az {formatPrice(Number(coupon.min_subtotal))} alışveriş</span>
                {coupon.max_discount !== null && coupon.discount_type === 'percent' && <span>En fazla {formatPrice(Number(coupon.max_discount))} indirim</span>}
                <span><CalendarClock size={15} style={{ verticalAlign: 'middle' }} /> {coupon.expires_at ? `Son gün: ${new Date(coupon.expires_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : 'Bitiş tarihi yok'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <code style={{ padding: '9px 12px', background: '#f6f7f9', borderRadius: 9, fontSize: 14, fontWeight: 800, letterSpacing: '.05em' }}>{coupon.code}</code>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" disabled={!available} onClick={() => setCouponCode(coupon.code)} style={{ cursor: available ? 'pointer' : 'not-allowed', padding: '10px 14px', background: available ? '#e85c35' : '#e5e7eb', color: available ? '#fff' : '#707782', border: 0, borderRadius: 9, fontWeight: 750 }}>
                    {selected ? <><Check size={15} style={{ verticalAlign: 'middle' }} /> Sepete kaydedildi</> : 'Sepette kullan'}
                  </button>
                  <Link href="/sepet" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 14px', border: '1px solid #dfe2e8', borderRadius: 9, fontSize: 13, fontWeight: 700 }}><ShoppingBag size={15} /> Sepete git</Link>
                </div>
              </div>
              <small style={{ color: '#828993' }}>Kupon koşulları ve kullanım hakları sipariş sırasında yeniden doğrulanır.</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
