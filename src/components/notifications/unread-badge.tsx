'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { NotificationAudience } from '@/lib/notifications';
import styles from './notification-center.module.css';

/** Unread counts are fetched under the signed-in user's RLS policy. */
export function NotificationUnreadBadge({ audience }: { audience: NotificationAudience }) {
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const { count: unread, error } = await supabase
        .from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('audience', audience)
        .is('read_at', null);
      if (active && !error) setCount(unread ?? 0);
    }
    void refresh();
    const handleRefresh = () => {
      void refresh();
    };
    const timer = window.setInterval(handleRefresh, 30_000);
    window.addEventListener('oz-notifications-changed', handleRefresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('oz-notifications-changed', handleRefresh);
    };
  }, [audience, supabase]);

  if (count <= 0) return null;
  return (
    <span className={styles.unreadBadge} aria-label={`${count} okunmamış bildirim`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
