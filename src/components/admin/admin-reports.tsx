import Link from 'next/link';

import { formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/admin-orders';
import styles from './admin-reports.module.css';

type ReportData = {
  count: number;
  activeCount: number;
  nominalTotal: number;
  average: number;
  days: { date: string; count: number; amount: number }[];
  statuses: { status: string; count: number }[];
  products: { name: string; quantity: number }[];
};


export function AdminReports({
  period,
  data,
  error,
}: {
  period: number;
  data: ReportData;
  error: string | null;
}) {
  const max = Math.max(1, ...data.days.map((d) => d.count));
  return (
    <section className="admin-body">
      <header className="admin-page-heading">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE · ANALİTİK</span>
          <h1>
            Sipariş raporları<span className="orange-dot">.</span>
          </h1>
          <p>Satış tahsilatı değil, sipariş taleplerine ilişkin operasyonel analiz.</p>
        </div>
      </header>
      <div className={styles.notice}>
        <strong>Gelir uyarısı:</strong> Gösterilen parasal değerler iptal edilmemiş sipariş
        taleplerinin toplamıdır; tahsilat, ciro veya kâr değildir. İade/tahsilat kayıtlarına göre
        netleştirilmemiştir.
      </div>
      <nav className={styles.periods} aria-label="Rapor dönemi">
        {[7, 30, 90, 365].map((n) => (
          <Link
            key={n}
            aria-current={period === n ? 'page' : undefined}
            className={period === n ? styles.selected : ''}
            href={`/admin/raporlar?period=${n}`}
          >
            Son {n} gün
          </Link>
        ))}
      </nav>
      {error ? (
        <p role="alert" className="admin-form-error">
          Rapor yüklenemedi: {error}
        </p>
      ) : (
        <>
          <div className={styles.stats}>
            <div>
              <small>Toplam sipariş talebi</small>
              <strong>{data.count}</strong>
            </div>
            <div>
              <small>İptal edilmemiş talep</small>
              <strong>{data.activeCount}</strong>
            </div>
            <div>
              <small>Nominal talep tutarı</small>
              <strong>{formatPrice(data.nominalTotal)}</strong>
            </div>
            <div>
              <small>Ortalama talep tutarı</small>
              <strong>{formatPrice(data.average)}</strong>
            </div>
          </div>
          <section className={styles.panel}>
            <h2>Günlük sipariş talepleri</h2>
            <p>
              Seçilen dönemde oluşturulan sipariş adedi (İstanbul saatine göre); yatay
              kaydırılabilir.
            </p>
            <div className={styles.scroll}>
              <div
                className={styles.chart}
                role="img"
                aria-label="Günlük sipariş talebi çubuk grafiği"
              >
                {data.days.map((d) => (
                  <div
                    key={d.date}
                    className={styles.day}
                    title={`${d.date}: ${d.count} talep, ${formatPrice(d.amount)} iptal edilmemiş nominal tutar`}
                  >
                    <span>{d.count}</span>
                    <div className={styles.track}>
                      <div
                        style={{
                          height: `${d.count ? Math.max(5, (d.count / max) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <small>{d.date.slice(5)}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div className={styles.columns}>
            <section className={styles.panel}>
              <h2>Sipariş durumları</h2>
              {data.statuses.length ? (
                data.statuses.map((s) => (
                  <div key={s.status} className={styles.line}>
                    <span>{ORDER_STATUS_LABELS[s.status as keyof typeof ORDER_STATUS_LABELS] ?? s.status}</span>
                    <strong>{s.count}</strong>
                  </div>
                ))
              ) : (
                <p>Bu dönemde sipariş yok.</p>
              )}
            </section>
            <section className={styles.panel}>
              <h2>En çok talep edilen ürünler</h2>
              <p>İptal edilmemiş siparişlerdeki ürün adetleri.</p>
              {data.products.length ? (
                data.products.map((p, i) => (
                  <div key={`${p.name}-${i}`} className={styles.line}>
                    <span>
                      {i + 1}. {p.name}
                    </span>
                    <strong>{p.quantity} adet</strong>
                  </div>
                ))
              ) : (
                <p>Bu dönemde ürün talebi yok.</p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
