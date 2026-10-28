'use client';

import Link from 'next/link';

import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  Clock3,
  Package,
  PackageCheck,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  Truck,
} from 'lucide-react';

import { formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/admin-orders';
import styles from './admin-overview.module.css';

export type AdminDashboardSummary = {
  totalProducts: number;
  activeProducts: number;
  totalStockUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalRequests: number;
  newRequests: number;
  contactedRequests: number;
  processingRequests: number;
  shippingRequests: number;
  deliveredRequests: number;
  cancelledRequests: number;
  periodRequests: number;
  periodRequestedTotal: number;
  dailyRequests: { date: string; count: number; amount: number }[];
  topRequestedProducts: { name: string; quantity: number }[];
};
export type DashboardOrder = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  total: number;
  deliveryMethod: string;
};
export type DashboardLowStock = {
  id: string;
  name: string;
  slug: string;
  stock: number;
  threshold: number;
};



function formatDay(value: string) {
  const [, month, day] = value.split('-');
  return `${day}.${month}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminOverview({
  summary,
  recentOrders,
  lowStockProducts,
  loadError,
}: {
  summary: AdminDashboardSummary | null;
  recentOrders: DashboardOrder[];
  lowStockProducts: DashboardLowStock[];
  loadError: string | null;
}) {
  const chart = summary?.dailyRequests ?? [];
  const maxCount = Math.max(1, ...chart.map((day) => Number(day.count) || 0));

  return (
    <section className="admin-body">
      <header className="admin-page-heading">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE · İŞLETME DURUMU</span>
          <h1>
            Genel bakış<span className="orange-dot">.</span>
          </h1>
          <p>Ürünler, stoklar ve sipariş talepleri tek ekranda.</p>
        </div>
        <Link className="button button-outline" href="/admin/siparisler">
          Siparişleri yönet <ArrowRight size={17} />
        </Link>
      </header>

      <div className={styles.notice} role="note">
        <TriangleAlert size={20} aria-hidden="true" />
        <div>
          <strong>Ödeme entegrasyonu henüz aktif değil.</strong>
          <span>
            {' '}
            Aşağıdaki tutarlar müşterilerin oluşturduğu{' '}
            <b>sipariş taleplerinin nominal değeridir</b>; tahsil edilen satış veya net gelir
            değildir.
          </span>
        </div>
      </div>
      {loadError && (
        <p role="alert" className="admin-form-error">
          Rapor yüklenemedi: {loadError}
        </p>
      )}

      {summary ? (
        <>
          <div className={styles.stats}>
            <Metric
              icon={<ShoppingBag size={21} />}
              label="Tüm sipariş talepleri"
              value={summary.totalRequests}
              hint="Tüm zamanlar"
            />
            <Metric
              icon={<Clock3 size={21} />}
              label="Görüşme bekleyen"
              value={summary.newRequests}
              hint="İşlem gerektiriyor"
              accent
            />
            <Metric
              icon={<PackageCheck size={21} />}
              label="Hazırlanan siparişler"
              value={summary.processingRequests}
              hint="Stoktan düşüldü"
            />
            <Metric
              icon={<Truck size={21} />}
              label="Kargodaki siparişler"
              value={summary.shippingRequests}
              hint="Teslimat sürecinde"
            />
            <Metric
              icon={<Boxes size={21} />}
              label="Yayındaki ürünler"
              value={summary.activeProducts}
              hint={`${summary.totalStockUnits} adet stok · ${summary.totalProducts} kayıtlı ürün`}
            />
            <Metric
              icon={<TriangleAlert size={21} />}
              label="Kritik stok"
              value={summary.lowStockProducts + summary.outOfStockProducts}
              hint={`${summary.outOfStockProducts} ürün tükendi`}
              accent={summary.lowStockProducts + summary.outOfStockProducts > 0}
            />
          </div>

          <div className={styles.twoColumns}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>
                    <BarChart3 size={19} /> Son 14 günün talepleri
                  </h2>
                  <p>İstanbul saatine göre günlük adet</p>
                </div>
                <span className={styles.compactStat}>
                  {summary.periodRequests} <small>son 30 günde</small>
                </span>
              </div>
              <div className={styles.chartScroller}>
                <div
                  className={styles.chart}
                  role="img"
                  aria-label="Son 14 günün günlük sipariş talebi adetleri"
                >
                  {chart.map((day) => (
                    <div
                      className={styles.chartDay}
                      key={day.date}
                      title={`${day.date}: ${day.count} talep`}
                    >
                      <span className={styles.chartCount}>{Number(day.count) || 0}</span>
                      <div className={styles.track}>
                        <span
                          className={styles.bar}
                          style={{
                            height: `${Math.max(day.count > 0 ? 8 : 0, (Number(day.count) / maxCount) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className={styles.chartDate}>{formatDay(day.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.panelFooter}>
                <span>Son 30 günün iptal edilmemiş talep tutarı</span>
                <strong>{formatPrice(Number(summary.periodRequestedTotal) || 0)}</strong>
              </div>
              <p className={styles.footnote}>
                Talepler henüz tahsilat anlamına gelmez. İptal edilmiş talepler tutardan
                çıkarılmıştır.
              </p>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>
                    <TrendingUp size={19} /> Sipariş dağılımı
                  </h2>
                  <p>Tüm zamanlar · anlık durum</p>
                </div>
              </div>
              <div className={styles.statusList}>
                {[
                  { label: 'Yeni', count: summary.newRequests, tone: '#fd794e' },
                  { label: 'Görüşüldü', count: summary.contactedRequests, tone: '#edab49' },
                  { label: 'Hazırlanıyor', count: summary.processingRequests, tone: '#437bd9' },
                  { label: 'Kargoda', count: summary.shippingRequests, tone: '#af77de' },
                  { label: 'Teslim edildi', count: summary.deliveredRequests, tone: '#2caa78' },
                  { label: 'İptal', count: summary.cancelledRequests, tone: '#959da8' },
                ].map((item) => (
                  <div key={item.label} className={styles.statusRow}>
                    <div>
                      <span className={styles.dot} style={{ backgroundColor: item.tone }} />
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className={styles.progress}>
                      <span
                        style={{
                          width: `${summary.totalRequests > 0 ? (item.count / summary.totalRequests) * 100 : 0}%`,
                          backgroundColor: item.tone,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className={styles.footnote}>
                Önceki sürümde tamamlanan kayıtlar “Teslim edildi” toplamına dahildir.
              </p>
            </section>
          </div>

          <div className={styles.twoColumns}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>
                    <ClipboardList size={19} /> Son sipariş talepleri
                  </h2>
                  <p>Son 6 kayıt</p>
                </div>
                <Link href="/admin/siparisler" className={styles.link}>
                  Tümünü görüntüle <ArrowRight size={15} />
                </Link>
              </div>
              {recentOrders.length ? (
                <div className={styles.rows}>
                  {recentOrders.map((order) => (
                    <div key={order.id} className={styles.orderRow}>
                      <div className={styles.rowIdentity}>
                        <strong>{order.reference}</strong>
                        <small>
                          {formatDate(order.createdAt)} ·{' '}
                          {order.deliveryMethod === 'pickup'
                            ? 'Mağazadan teslim'
                            : 'Kargo/teslimat'}
                        </small>
                      </div>
                      <div className={styles.rowRight}>
                        <span className={styles.statusTag}>
                          {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                        </span>
                        <strong>{formatPrice(order.total)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>Henüz sipariş talebi bulunmuyor.</p>
              )}
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>
                    <TriangleAlert size={19} /> Stok uyarıları
                  </h2>
                  <p>Aktif ve kritik stoklu ürünler</p>
                </div>
                <Link href="/admin/urunler" className={styles.link}>
                  Ürünlere git <ArrowRight size={15} />
                </Link>
              </div>
              {lowStockProducts.length ? (
                <div className={styles.rows}>
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className={styles.stockRow}>
                      <div className={styles.rowIdentity}>
                        <strong>{product.name}</strong>
                        <small>Uyarı sınırı: {product.threshold} adet</small>
                      </div>
                      <span className={product.stock === 0 ? styles.stockEmpty : styles.stockLow}>
                        {product.stock === 0 ? 'Stok yok' : `${product.stock} adet`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>Kritik stoklu aktif ürün bulunmuyor.</p>
              )}
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>
                  <Package size={19} /> En çok talep edilen ürünler
                </h2>
                <p>Son 30 gün · iptal edilmeyen talepler</p>
              </div>
              <span className={styles.subtle}>Tahsil edilmiş satış sıralaması değildir</span>
            </div>
            {summary.topRequestedProducts.length ? (
              <div className={styles.topProducts}>
                {summary.topRequestedProducts.map((product, index) => (
                  <div key={`${product.name}-${index}`}>
                    <span className={styles.rank}>{index + 1}</span>
                    <span>{product.name}</span>
                    <strong>{product.quantity} adet</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>Bu dönemde ürün talebi bulunmuyor.</p>
            )}
          </section>
        </>
      ) : !loadError ? (
        <p className={styles.empty}>Henüz gösterilecek rapor verisi bulunmuyor.</p>
      ) : null}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className={`${styles.metric}${accent ? ` ${styles.metricAccent}` : ''}`}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricLabel}>{label}</span>
      <strong>{value.toLocaleString('tr-TR')}</strong>
      <small>{hint}</small>
    </div>
  );
}
