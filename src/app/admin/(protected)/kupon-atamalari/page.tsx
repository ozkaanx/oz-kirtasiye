import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { CouponAssignments } from '@/components/admin/coupon-assignments';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Özel Kupon Atamaları',
  robots: { index: false, follow: false },
};
export default async function CouponAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer } = await searchParams;
  const db = await createServerSupabase();
  const [coupons, assignments, customers] = await Promise.all([
    db
      .from('coupons')
      .select('id,code,label,is_active')
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('coupon_private_assignments').select('coupon_id,user_id').limit(500),
    db.rpc('admin_crm_customers'),
  ]);
  return (
    <section className="container-wide" style={{ paddingBlock: '36px 80px', maxWidth: 900 }}>
      <Link href="/admin/musteriler">← Müşterilere dön</Link>
      <h1 style={{ marginTop: 20 }}>Müşteriye özel kupon atama</h1>
      <p style={{ color: '#68727e' }}>
        Müşteriyi seç, kuponu ata. Atanan kupon yalnızca o hesaptan kullanılabilir.
      </p>
      {(coupons.error || assignments.error || customers.error) && (
        <p role="alert">
          Veriler yüklenemedi:{' '}
          {coupons.error?.message ?? assignments.error?.message ?? customers.error?.message}
        </p>
      )}
      <CouponAssignments
        coupons={coupons.data ?? []}
        assignments={assignments.data ?? []}
        initialUser={customer ?? ''}
        customers={(customers.data ?? []).map(
          (c: { user_id: string; full_name: string; email: string }) => ({
            id: c.user_id,
            name: c.full_name,
            email: c.email,
          }),
        )}
      />
    </section>
  );
}
