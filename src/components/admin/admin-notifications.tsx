'use client';

import { Bell } from 'lucide-react';

import { NotificationCenter } from '@/components/notifications/notification-center';

import type { StoreNotification } from '@/lib/notifications';
import styles from '@/components/notifications/notification-center.module.css';

export function AdminNotifications({
  notifications,
  loadError,
}: {
  notifications: StoreNotification[];
  loadError: string | null;
}) {
  return (
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
  );
}
