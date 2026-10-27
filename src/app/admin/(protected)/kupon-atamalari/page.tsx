import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { CouponAssignments } from '@/components/admin/coupon-assignments';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Özel Kupon Atamaları', robots: { index: false, follow: false } };
export default async function CouponAssignmentsPage() {
  const db = await createServerSupabase();
  const [coupons, assignments] = await Promise.all([
    db.from('coupons').select('id,code,label,is_active').order('created_at', { ascending:false }).limit(500),
    db.from('coupon_private_assignments').select('coupon_id,user_id').limit(500),
  ]);
  return <main className="container-wide" style={{paddingBlock:'36px 80px',maxWidth:900}}>
    <Link href="/admin/kuponlar">← Kupon yönetimine dön</Link>
    <h1 style={{marginTop:20}}>Müşteriye özel kupon atama</h1>
    <p style={{color:'#68727e'}}>Mevcut bir kuponu tek müşteriye özel yap. Atama yapıldıktan sonra kuponu yalnızca o kullanıcı hesabı kullanabilir.</p>
    {(coupons.error || assignments.error) && <p role="alert">Veriler yüklenemedi: {coupons.error?.message ?? assignments.error?.message}</p>}
    <CouponAssignments coupons={(coupons.data ?? [])} assignments={(assignments.data ?? [])} />
  </main>;
}
