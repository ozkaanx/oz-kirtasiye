import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { NotificationCenter } from '@/components/notifications/notification-center';
import type { StoreNotification } from '@/lib/notifications';
import styles from '@/components/notifications/notification-center.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Bildirimlerim',
  robots: { index: false, follow: false },
};

export default async function CustomerNotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect('/giris?next=%2Fhesabim%2Fbildirimler');

  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,audience,event_type,title,body,href,read_at,created_at')
    .eq('audience', 'customer')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className={`container-wide ${styles.customerPage}`}>
      <div className={styles.customerHeader}>
        <Link href="/hesabim" className={styles.backLink}>
          ← Hesabıma dön
        </Link>
        <h1>
          Bildirimlerim<span className="orange-dot">.</span>
        </h1>
        <p>Sipariş ve iade/değişim taleplerindeki gelişmeler.</p>
      </div>
      <div className={styles.customerCard}>
        <NotificationCenter
          audience="customer"
          initialNotifications={(data ?? []) as StoreNotification[]}
          loadError={error?.message ?? null}
        />
      </div>
    </main>
  );
}
