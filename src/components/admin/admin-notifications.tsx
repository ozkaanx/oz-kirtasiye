'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, LogOut } from 'lucide-react';
import { useMemo } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { StoreNotification } from '@/lib/notifications';
import styles from '@/components/notifications/notification-center.module.css';

export function AdminNotifications({
  notifications,
  loadError,
}: {
  notifications: StoreNotification[];
  loadError: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.replace('/admin/giris');
      router.refresh();
    }
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">
        <header className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button type="button" className="admin-logout" onClick={() => void logout()}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </header>
        <div className="admin-body">
          <div className={styles.adminHeading}>
            <span className="section-eyebrow">
              <Bell size={14} /> YÖNETİM
            </span>
            <h1>Bildirim Merkezi</h1>
            <p>Yeni sipariş ve iade taleplerini buradan takip edebilirsin.</p>
          </div>
          <NotificationCenter
            audience="admin"
            initialNotifications={notifications}
            loadError={loadError}
          />
        </div>
      </main>
    </div>
  );
}
