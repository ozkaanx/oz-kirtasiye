import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { LoyaltyCouponEntry } from '@/components/account/loyalty-coupon-entry';
import { MyPrivateCoupons, type PrivateCoupon } from '@/components/account/my-private-coupons';

export const metadata: Metadata = { title: 'Avantajlarım', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CustomerBenefitsPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/giris?next=%2Fhesabim%2Favantajlar');

  const { data: coupons, error: couponsError } = await supabase.rpc('my_private_coupons');
  const { count, error: countError } = await supabase
    .from('order_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_user_id', user.id)
    .in('status', ['delivered', 'completed']);

  return (
    <main className="container-wide" style={{ paddingBlock: '48px 84px', maxWidth: 940 }}>
      <nav style={{ marginBottom: 24, fontSize: 14 }}><Link href="/hesabim">← Hesabıma dön</Link></nav>
      <span className="section-eyebrow">ÖZ KIRTASİYE · MÜŞTERİ AVANTAJLARI</span>
      <h1 style={{ marginTop: 10 }}>Avantajlarım<span className="orange-dot">.</span></h1>
      <p style={{ color: '#68727e', lineHeight: 1.7 }}>Tekrar alışverişini kolaylaştır, sana iletilen kuponları sepetinde kullan.</p>
      <div style={{ background: '#fff7f3', border: '1px solid #ffdfce', borderRadius: 16, padding: 22, marginBlock: 24 }}>
        <p style={{ margin: '0 0 4px', color: '#9d4728', fontSize: 13 }}>Hesabına bağlı teslim edilmiş / tamamlanmış siparişler</p>
        <strong style={{ fontSize: 34 }}>{countError ? '—' : (count ?? 0)}</strong>
        <p style={{ fontSize: 12, color: '#7a6360', marginBottom: 0 }}>Bu sayı bir puan veya otomatik indirim hakkı değildir. Misafir siparişleri sayılmaz.</p>
      </div>
      <MyPrivateCoupons coupons={(coupons ?? []) as PrivateCoupon[]} loadError={couponsError ? 'Kuponların yüklenemedi. Sayfayı yenileyip tekrar dene.' : null} />
      <LoyaltyCouponEntry />
      <p style={{ marginTop: 20, color: '#6d7681', fontSize: 13, lineHeight: 1.7 }}>
        Kupon indirimi sepette ve sipariş talebi gönderilirken mevcut kurallar, tarih ve kullanım limitleri doğrultusunda yeniden kontrol edilir. Kuponun kaydedilmesi indirim garantisi veya ödeme tahsilatı anlamına gelmez.
      </p>
    </main>
  );
}
