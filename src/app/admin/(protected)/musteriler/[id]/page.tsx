import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TicketPercent, UserRound, ShoppingBag, Repeat2 } from 'lucide-react';
import { createServerSupabase } from '@/lib/supabase/server';

import { formatPrice } from '@/lib/format';
import styles from '@/components/admin/admin-customers.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Müşteri Detayı',
  robots: { index: false, follow: false },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (v: string) =>
  new Date(v).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
const statuses: Record<string, string> = {
  new: 'Yeni talep',
  contacted: 'Görüşüldü',
  processing: 'Hazırlanıyor',
  shipped: 'Kargoda',
  delivered: 'Teslim edildi',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = await createServerSupabase();
  const [{ data: orders, error }, { count, error: countError }] = await Promise.all([
    db
      .from('order_requests')
      .select('id,reference,customer_name,phone,status,total,created_at,delivery_method')
      .eq('customer_user_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('order_requests')
      .select('id', { count: 'exact', head: true })
      .eq('customer_user_id', id),
  ]);
  if (!error && !countError && !count) notFound();
  const rows = orders ?? [];
  const latest = rows[0];
  const active = rows.filter((o) => o.status !== 'cancelled');
  const total = active.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  return (
    <div className="admin-body">
      <div className={styles.profileToolbar}>
        <Link className="button button-outline" href="/admin/musteriler">
          <ArrowLeft size={16} /> Müşterilere dön
        </Link>
        <Link
          className="button button-primary"
          href={`/admin/kupon-atamalari?customer=${encodeURIComponent(id)}`}
        >
          <TicketPercent size={16} /> Kupon ata
        </Link>
      </div>
      <header className="admin-page-heading">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE · CRM / MÜŞTERİ DETAYI</span>
          <h1>
            {latest?.customer_name || 'Müşteri'}
            <span className="orange-dot">.</span>
          </h1>
          <p>İletişim bilgileri, sipariş geçmişi ve müşteri hareketleri.</p>
        </div>
        <UserRound size={30} />
      </header>
      {(error || countError) && (
        <p role="alert" className="admin-form-error">
          Müşteri verileri yüklenemedi: {error?.message ?? countError?.message}
        </p>
      )}
      <div className={styles.profileGrid}>
        <div className={styles.profileCard}>
          <ShoppingBag size={21} />
          <span>Toplam sipariş talebi</span>
          <strong>{count ?? 0}</strong>
        </div>
        <div className={styles.profileCard}>
          <Repeat2 size={21} />
          <span>İptal edilmemiş talepler (gösterilen)</span>
          <strong>{active.length}</strong>
        </div>
        <div className={styles.profileCard}>
          <TicketPercent size={21} />
          <span>Talep tutarı (gösterilen)</span>
          <strong>{formatPrice(total)}</strong>
        </div>
      </div>
      <section className={styles.historyPanel}>
        <h2>Müşteri bilgileri</h2>
        <div className={styles.profileInfo}>
          <div>
            <span>Ad soyad (son sipariş kaydı)</span>
            <strong>{latest?.customer_name || 'Belirtilmemiş'}</strong>
          </div>
          <div>
            <span>Telefon (son sipariş kaydı)</span>
            <strong>{latest?.phone || 'Belirtilmemiş'}</strong>
          </div>
          <div>
            <span>Üye kimliği</span>
            <strong>{id}</strong>
          </div>
          <div>
            <span>Son sipariş</span>
            <strong>{latest ? fmt(latest.created_at) : '—'}</strong>
          </div>
        </div>
      </section>
      <section className={styles.historyPanel} style={{ marginTop: 20 }}>
        <h2>Sipariş geçmişi</h2>
        <p className={styles.notice}>
          Siparişler en yeniden eskiye sıralıdır. En son 100 kayıt gösterilir. Tutarlar tahsil
          edilen gelir değil, sipariş talebi değeridir.
        </p>
        {rows.length === 0 && !error && <p>Henüz sipariş bulunamadı.</p>}
        {rows.map((order) => (
          <div key={order.id} className={styles.historyRow}>
            <div>
              <strong>#{order.reference}</strong>
              <small>
                {fmt(order.created_at)} · {statuses[order.status] ?? order.status}
              </small>
              <small>
                {order.delivery_method === 'pickup' ? 'Mağazadan teslim' : 'Kargo / teslimat'}
              </small>
            </div>
            <strong>{formatPrice(Number(order.total) || 0)}</strong>
          </div>
        ))}
        {(count ?? 0) > 100 && (
          <p className={styles.notice}>
            Bu müşterinin daha eski siparişleri için sonraki aşamada sayfalama eklenebilir.
          </p>
        )}
      </section>
    </div>
  );
}
