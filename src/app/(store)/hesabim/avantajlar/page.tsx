import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BadgePercent, Gift, Info } from 'lucide-react';
import { createServerSupabase } from '@/lib/supabase/server';
import { AccountSubpage } from '@/components/account/account-subpage';
import { LoyaltyCouponEntry } from '@/components/account/loyalty-coupon-entry';
import { MyPrivateCoupons, type PrivateCoupon } from '@/components/account/my-private-coupons';
import styles from '@/components/account/customer-benefits.module.css';

export const metadata: Metadata = { title: 'Avantajlarım', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CustomerBenefitsPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/giris?next=%2Fhesabim%2Favantajlar');

  const [{ data: coupons, error: couponsError }, { count, error: countError }] = await Promise.all([
    supabase.rpc('my_private_coupons'),
    supabase.from('order_requests')
      .select('id', { count: 'exact', head: true })
      .eq('customer_user_id', user.id)
      .in('status', ['delivered', 'completed']),
  ]);

  return (
    <AccountSubpage
      active="benefits"
      title="Avantajlarım"
      description="Sana özel kuponları görüntüle, indirim kodlarını sepetine kaydet."
      icon={<BadgePercent />}
    >
      <div className={styles.summary}>
        <span className={styles.summaryIcon} aria-hidden="true"><Gift size={25} /></span>
        <div className={styles.summaryBody}>
          <span className={styles.summaryLabel}>Teslim edilmiş / tamamlanmış siparişlerim</span>
          <strong className={styles.summaryNumber}>{countError ? '—' : (count ?? 0)}</strong>
          <p>Bu sayı puan veya otomatik indirim hakkı değildir; misafir siparişleri dahil edilmez.</p>
          {countError && <p role="alert" className={styles.warning}>Sipariş sayısı şu anda yüklenemedi.</p>}
        </div>
      </div>
      <div className={styles.sections}>
        <MyPrivateCoupons
          coupons={(coupons ?? []) as PrivateCoupon[]}
          loadError={couponsError ? 'Kuponların yüklenemedi. Sayfayı yenileyip tekrar dene.' : null}
        />
        <LoyaltyCouponEntry />
      </div>
      <p className={styles.disclaimer}>
        <Info size={17} aria-hidden="true" />
        Kupon koşulları, kullanım limiti ve indirim tutarı sipariş sırasında yeniden doğrulanır.
        Kodun kaydedilmesi ödeme veya indirim garantisi değildir.
      </p>
    </AccountSubpage>
  );
}
