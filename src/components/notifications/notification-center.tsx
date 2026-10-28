'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, CheckCheck, CircleCheck, ExternalLink } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import {
  formatNotificationDate,
  type NotificationAudience,
  type StoreNotification,
} from '@/lib/notifications';
import styles from './notification-center.module.css';

function broadcastChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('oz-notifications-changed'));
}

export function NotificationCenter({
  audience,
  initialNotifications,
  loadError,
}: {
  audience: NotificationAudience;
  initialNotifications: StoreNotification[];
  loadError: string | null;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(loadError ?? '');
  const [success, setSuccess] = useState('');

  // Refresh the list while this page is open; sidebar badges poll independently.
  useEffect(() => {
    let active = true;
    async function refresh() {
      const { data, error: readError } = await supabase
        .from('user_notifications')
        .select('id,audience,event_type,title,body,href,read_at,created_at')
        .eq('audience', audience)
        .order('created_at', { ascending: false })
        .limit(100);
      if (active && !readError) setNotifications((data ?? []) as StoreNotification[]);
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [audience, supabase]);

  const unread = notifications.filter((notice) => notice.read_at === null).length;
  const visible = notifications.filter((notice) => filter === 'all' || notice.read_at === null);

  async function markRead(id: string) {
    if (busy || busyId) return;
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      const timestamp = new Date().toISOString();
      const { error: writeError } = await supabase
        .from('user_notifications')
        .update({ read_at: timestamp })
        .eq('id', id)
        .eq('audience', audience)
        .is('read_at', null);
      if (writeError) throw new Error(writeError.message);
      setNotifications((current) =>
        current.map((notice) => (notice.id === id ? { ...notice, read_at: timestamp } : notice)),
      );
      broadcastChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bildirim işaretlenemedi.');
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (busy || busyId || unread === 0) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const timestamp = new Date().toISOString();
      const { error: writeError } = await supabase
        .from('user_notifications')
        .update({ read_at: timestamp })
        .eq('audience', audience)
        .is('read_at', null);
      if (writeError) throw new Error(writeError.message);
      setNotifications((current) =>
        current.map((notice) => ({
          ...notice,
          read_at: notice.read_at ?? timestamp,
        })),
      );
      setSuccess('Okunmamış bildirimlerin işaretlendi.');
      broadcastChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bildirimler işaretlenemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.center} aria-label="Bildirim merkezi">
      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Bildirim filtreleri">
          <button
            type="button"
            className={filter === 'all' ? styles.selected : ''}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Tümü ({notifications.length})
          </button>
          <button
            type="button"
            className={filter === 'unread' ? styles.selected : ''}
            aria-pressed={filter === 'unread'}
            onClick={() => setFilter('unread')}
          >
            Okunmamış ({unread})
          </button>
        </div>
        <button
          type="button"
          className={styles.markAll}
          disabled={busy || !!busyId || !unread}
          onClick={() => void markAllRead()}
        >
          <CheckCheck size={17} /> Tümünü okundu yap
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}

      {visible.length ? (
        <div className={styles.list}>
          {visible.map((notice) => (
            <article
              className={`${styles.notice} ${notice.read_at ? '' : styles.notRead}`}
              key={notice.id}
            >
              <div className={styles.noticeIcon} aria-hidden="true">
                {notice.read_at ? <CircleCheck size={18} /> : <Bell size={18} />}
              </div>
              <div className={styles.noticeContent}>
                <div className={styles.noticeMeta}>
                  <time dateTime={notice.created_at}>
                    {formatNotificationDate(notice.created_at)}
                  </time>
                  {!notice.read_at && <span className={styles.unreadMarker}>Yeni</span>}
                </div>
                <h3>{notice.title}</h3>
                <p>{notice.body}</p>
                <div className={styles.noticeActions}>
                  <Link href={notice.href} className={styles.openLink}>
                    İlgili sayfaya git <ExternalLink size={14} />
                  </Link>
                  {!notice.read_at && (
                    <button
                      type="button"
                      disabled={busy || !!busyId}
                      onClick={() => void markRead(notice.id)}
                    >
                      <CheckCheck size={15} />{' '}
                      {busyId === notice.id ? 'Kaydediliyor...' : 'Okundu olarak işaretle'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : !error ? (
        <div className={styles.empty}>
          <BellOff size={34} aria-hidden="true" />
          <h3>{filter === 'unread' ? 'Okunmamış bildirim yok' : 'Henüz bildirimin yok'}</h3>
          <p>
            {filter === 'unread'
              ? 'Yeni bir bildirim geldiğinde burada görebilirsin.'
              : 'Sipariş ve iade işlemlerindeki gelişmeler burada görünecek.'}
          </p>
        </div>
      ) : null}
      <p className={styles.limitNotice}>
        Son 100 bildirim gösteriliyor. Okunmamış sayaçları tüm kayıtları kapsar. Bildirimler
        uygulama açıkken yaklaşık 30 saniyede bir güncellenir.
      </p>
    </section>
  );
}
