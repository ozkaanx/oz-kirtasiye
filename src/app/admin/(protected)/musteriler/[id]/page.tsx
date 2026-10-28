import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TicketPercent, UserRound, ShoppingBag, Repeat2 } from 'lucide-react';
import { createServerSupabase } from '@/lib/supabase/server';

import {
  customerPage,
  customerOrdersHref,
  isCustomerId,
  type CustomerOrdersResult,
} from '@/lib/admin-customer-catalog';
import { operationTrace } from '@/lib/operation-trace';
import filterStyles from '@/components/admin/admin-list-filters.module.css';
import { formatPrice } from '@/lib/format';
import styles from '@/components/admin/admin-customers.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Müşteri Detayı',
  robots: { index: false, follow: false },
};
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

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!isCustomerId(id)) notFound();
  const page = customerPage(await searchParams);
  const trace = operationTrace('admin_customer_detail');
  let result: CustomerOrdersResult | null = null;
  let loadError: string | null = null;
  try {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc('admin_customer_orders', { p_customer: id, p_page: page });
    if (error || !data || !Array.isArray(data.rows)) {
      trace.error(error ? 'database_error' : 'empty_result', error?.code);
      loadError = 'Müşteri verileri yüklenemedi. Tekrar deneyin. Takip kodu: ' + trace.requestId;
    } else result = data as CustomerOrdersResult;
  } catch {
    trace.error('unexpected');
    loadError = 'Müşteri servisine ulaşılamadı. Takip kodu: ' + trace.requestId;
  }
  if (result && result.total === 0) notFound();
  const rows = result?.rows ?? [];
  const latest = result?.latest;
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
      {loadError && (
        <p role="alert" className="admin-form-error">
          {loadError}
        </p>
      )}
      <div className={styles.profileGrid}>
        <div className={styles.profileCard}>
          <ShoppingBag size={21} />
          <span>Toplam sipariş talebi</span>
          <strong>{result?.total ?? '—'}</strong>
        </div>
        <div className={styles.profileCard}>
          <Repeat2 size={21} />
          <span>İptal edilmemiş talepler (tümü)</span>
          <strong>{result?.active ?? '—'}</strong>
        </div>
        <div className={styles.profileCard}>
          <TicketPercent size={21} />
          <span>İptal edilmemiş talep tutarı (tümü)</span>
          <strong>{result ? formatPrice(result.amount) : '—'}</strong>
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
          Siparişler en yeniden eskiye, sayfa başına 25 kayıt olarak gösterilir. Özetler müşterinin
          tüm siparişlerinden hesaplanır. Tutarlar tahsil edilen gelir değil, sipariş talebi
          değeridir.
        </p>
        {result && rows.length === 0 && <p>Henüz sipariş bulunamadı.</p>}
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
        {result && (
          <p className={styles.notice}>
            {rows.length} / {result.total} sipariş · Sayfa {result.page} /{' '}
            {Math.max(1, Math.ceil(result.total / result.pageSize))}
          </p>
        )}
        {result && (result.hasPrevious || result.hasNext) && (
          <nav className={filterStyles.filters} aria-label="Müşteri sipariş sayfaları">
            {result.hasPrevious && (
              <Link className={filterStyles.reset} href={customerOrdersHref(id, result.page - 1)}>
                Önceki sayfa
              </Link>
            )}
            {result.hasNext && (
              <Link className={filterStyles.reset} href={customerOrdersHref(id, result.page + 1)}>
                Sonraki sayfa
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
