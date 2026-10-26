'use client';

import { useMemo, useState } from 'react';
import { Check, Clock3, MessageSquare, Star, X } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import styles from './admin-review-moderation.module.css';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type AdminReview = {
  id: string;
  product_id: string;
  product_name: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  created_at: string;
};

type Tab = ReviewStatus | 'all';
const tabs: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Onay bekleyen' },
  { key: 'approved', label: 'Onaylanan' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'all', label: 'Tümü' },
];

export function AdminReviewModeration({ initialReviews, loadError }: { initialReviews: AdminReview[]; loadError?: string | null }) {
  const [items, setItems] = useState(initialReviews);
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(loadError ?? '');
  const counts = useMemo(() => ({
    pending: items.filter(x => x.status === 'pending').length,
    approved: items.filter(x => x.status === 'approved').length,
    rejected: items.filter(x => x.status === 'rejected').length,
    all: items.length,
  }), [items]);
  const approved = items.filter(x => x.status === 'approved');
  const average = approved.length ? approved.reduce((sum, x) => sum + x.rating, 0) / approved.length : null;
  const visible = items.filter(x => tab === 'all' || x.status === tab);

  async function moderate(id: string, status: 'approved' | 'rejected') {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      const { error: rpcError } = await createBrowserSupabase().rpc('moderate_product_review', {
        p_review_id: id, p_status: status,
      });
      if (rpcError) throw rpcError;
      setItems(current => current.map(item => item.id === id ? { ...item, status } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı, tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`container-wide ${styles.page}`}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>YÖNETİM PANELİ / MÜŞTERİ GERİ BİLDİRİMLERİ</span>
          <h1>Ürün yorumları<span className={styles.dot}>.</span></h1>
          <p>Müşterilerin değerlendirmelerini incele ve yayınlanacak yorumları yönet.</p>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}><Clock3 size={19} aria-hidden="true"/><span>Onay bekleyen</span><strong>{counts.pending}</strong></div>
        <div className={styles.stat}><Check size={19} aria-hidden="true"/><span>Onaylanan</span><strong>{counts.approved}</strong></div>
        <div className={styles.stat}><MessageSquare size={19} aria-hidden="true"/><span>Toplam yorum</span><strong>{counts.all}{counts.all === 1000 ? '+' : ''}</strong></div>
        <div className={styles.stat}><Star size={19} aria-hidden="true"/><span>Onaylı ortalama puan</span><strong>{average === null ? '—' : average.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} <small>/ 5</small></strong></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.tabs} role="tablist" aria-label="Yorum durumları">
          {tabs.map(item => (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key}
              className={`${styles.tab} ${tab === item.key ? styles.active : ''}`} onClick={() => setTab(item.key)}>
              {item.label} <span>{counts[item.key]}</span>
            </button>
          ))}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.list}>
          {visible.map(item => (
            <article className={styles.review} key={item.id}>
              <div className={styles.reviewHead}>
                <div>
                  <h2>{item.product_name}</h2>
                  <span className={styles.date}>{new Date(item.created_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <span className={`${styles.status} ${styles[item.status]}`}>
                  {item.status === 'pending' ? 'Onay bekliyor' : item.status === 'approved' ? 'Yayında' : 'Reddedildi'}
                </span>
              </div>
              <div className={styles.rating} aria-label={`${item.rating} / 5 yıldız`}>
                {Array.from({ length: 5 }, (_, index) => <Star key={index} size={17} fill={index < item.rating ? 'currentColor' : 'none'} />)}
                <strong>{item.rating}/5</strong>
              </div>
              <p className={styles.body}>{item.body}</p>
              <div className={styles.actions}>
                <span>Doğrulanmış satın alma değerlendirmesi</span>
                <div>
                  {item.status !== 'approved' && <button className={styles.approve} type="button" disabled={busy !== null} onClick={() => void moderate(item.id, 'approved')}><Check size={16}/> {busy === item.id ? 'İşleniyor...' : 'Onayla'}</button>}
                  {item.status !== 'rejected' && <button className={styles.reject} type="button" disabled={busy !== null} onClick={() => void moderate(item.id, 'rejected')}><X size={16}/> {busy === item.id ? 'İşleniyor...' : 'Reddet'}</button>}
                </div>
              </div>
            </article>
          ))}
          {!visible.length && <div className={styles.empty}><MessageSquare size={32} aria-hidden="true"/><strong>Bu bölümde yorum bulunmuyor.</strong><p>Yeni değerlendirmeler geldiğinde burada görüntülenecek.</p></div>}
        </div>
      </div>
      {counts.all === 1000 && <p className={styles.note}>En yeni 1000 yorum gösteriliyor. İstatistikler görüntülenen yorumlara aittir.</p>}
    </section>
  );
}
