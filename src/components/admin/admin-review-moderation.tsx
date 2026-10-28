'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  reviewSearchHref,
  type ReviewStatus,
  type ReviewSearch,
  type ReviewSearchResult,
} from '@/lib/admin-review-search';
import filterStyles from './admin-list-filters.module.css';
import { Check, Clock3, MessageSquare, Star, X } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import styles from './admin-review-moderation.module.css';

type Tab = ReviewStatus | 'all';
const tabs: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Onay bekleyen' },
  { key: 'approved', label: 'Onaylanan' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'all', label: 'Tümü' },
];

export function AdminReviewModeration({
  result,
  search,
  loadError,
}: {
  result: ReviewSearchResult | null;
  search: ReviewSearch;
  loadError?: string | null;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const counts = result?.stats;
  const average = counts?.average ?? null;
  const visible = result?.rows ?? [];
  const tab = search.status;
  async function moderate(id: string, status: 'approved' | 'rejected') {
    if (lock.current || refreshing) return;
    lock.current = true;
    setSuccess('');
    setBusy(id);
    setError('');
    try {
      const { error: rpcError } = await createBrowserSupabase().rpc('moderate_product_review', {
        p_review_id: id,
        p_status: status,
      });
      if (rpcError) throw rpcError;
      setSuccess(status === 'approved' ? 'Yorum onaylandı.' : 'Yorum reddedildi.');
      startTransition(() => router.refresh());
    } catch {
      setError('Yorum güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <section className={`container-wide ${styles.page}`}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>YÖNETİM PANELİ / MÜŞTERİ GERİ BİLDİRİMLERİ</span>
          <h1>
            Ürün yorumları<span className={styles.dot}>.</span>
          </h1>
          <p>Müşterilerin değerlendirmelerini incele ve yayınlanacak yorumları yönet.</p>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Clock3 size={19} aria-hidden="true" />
          <span>Onay bekleyen</span>
          <strong>{counts?.pending ?? '—'}</strong>
        </div>
        <div className={styles.stat}>
          <Check size={19} aria-hidden="true" />
          <span>Onaylanan</span>
          <strong>{counts?.approved ?? '—'}</strong>
        </div>
        <div className={styles.stat}>
          <MessageSquare size={19} aria-hidden="true" />
          <span>Toplam yorum</span>
          <strong>{counts?.all ?? '—'}</strong>
        </div>
        <div className={styles.stat}>
          <Star size={19} aria-hidden="true" />
          <span>Onaylı ortalama puan</span>
          <strong>
            {average === null ? '—' : average.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}{' '}
            <small>/ 5</small>
          </strong>
        </div>
      </div>
      <div className={styles.panel}>
        <nav className={styles.tabs} aria-label="Yorum durumları">
          {tabs.map((item) => (
            <Link
              key={item.key}
              href={reviewSearchHref({ ...search, status: item.key })}
              aria-current={tab === item.key ? 'page' : undefined}
              className={`${styles.tab} ${tab === item.key ? styles.active : ''}`}
            >
              {item.label} <span>{counts?.[item.key] ?? '—'}</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/yorumlar" method="get" className={filterStyles.filters}>
          <input type="hidden" name="status" value={search.status} />
          <label className={filterStyles.field}>
            Ürün veya yorum ara
            <input
              name="q"
              maxLength={100}
              defaultValue={search.q}
              placeholder="Ürün adı veya yorum metni"
            />
          </label>
          <button type="submit" className={filterStyles.reset}>
            Ara / Filtrele
          </button>
          <Link href="/admin/yorumlar" className={filterStyles.reset}>
            Filtreleri temizle
          </Link>
        </form>
        <p className={filterStyles.result}>
          {result
            ? `${visible.length} / ${result.total} yorum · Sayfa ${result.page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))}`
            : 'Yorum listesi yüklenemedi.'}
        </p>
        {loadError && (
          <p className={styles.error} role="alert">
            {loadError}
          </p>
        )}
        {success && (
          <p role="status" className={styles.note}>
            {success} {refreshing ? 'Liste güncelleniyor…' : ''}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.list}>
          {visible.map((item) => (
            <article className={styles.review} key={item.id}>
              <div className={styles.reviewHead}>
                <div>
                  <h2>{item.product_name}</h2>
                  <span className={styles.date}>
                    {new Date(item.created_at).toLocaleString('tr-TR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Europe/Istanbul',
                    })}
                  </span>
                </div>
                <span className={`${styles.status} ${styles[item.status]}`}>
                  {item.status === 'pending'
                    ? 'Onay bekliyor'
                    : item.status === 'approved'
                      ? 'Yayında'
                      : 'Reddedildi'}
                </span>
              </div>
              <div className={styles.rating} aria-label={`${item.rating} / 5 yıldız`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    size={17}
                    fill={index < item.rating ? 'currentColor' : 'none'}
                  />
                ))}
                <strong>{item.rating}/5</strong>
              </div>
              <p className={styles.body}>{item.body}</p>
              <div className={styles.actions}>
                <span>Doğrulanmış satın alma değerlendirmesi</span>
                <div>
                  {item.status !== 'approved' && (
                    <button
                      className={styles.approve}
                      type="button"
                      disabled={busy !== null || refreshing}
                      onClick={() => void moderate(item.id, 'approved')}
                    >
                      <Check size={16} /> {busy === item.id ? 'İşleniyor...' : 'Onayla'}
                    </button>
                  )}
                  {item.status !== 'rejected' && (
                    <button
                      className={styles.reject}
                      type="button"
                      disabled={busy !== null || refreshing}
                      onClick={() => void moderate(item.id, 'rejected')}
                    >
                      <X size={16} /> {busy === item.id ? 'İşleniyor...' : 'Reddet'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {result && !visible.length && (
            <div className={styles.empty}>
              <MessageSquare size={32} aria-hidden="true" />
              <strong>Bu bölümde yorum bulunmuyor.</strong>
              <p>Yeni değerlendirmeler geldiğinde burada görüntülenecek.</p>
            </div>
          )}
        </div>
      </div>
      <p className={styles.note}>
        Özetler tüm yorumları, ortalama puan tüm onaylı yorumları kapsar.
      </p>
      {result && (result.hasPrevious || result.hasNext) && (
        <nav className={filterStyles.filters} aria-label="Yorum sayfaları">
          {result.hasPrevious && (
            <Link className={filterStyles.reset} href={reviewSearchHref(search, result.page - 1)}>
              Önceki sayfa
            </Link>
          )}
          {result.hasNext && (
            <Link className={filterStyles.reset} href={reviewSearchHref(search, result.page + 1)}>
              Sonraki sayfa
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
