'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FolderTree,
  LogOut,
  Package,
  PackageCheck,
  PhoneCall,
  RotateCcw,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { formatPrice } from '@/lib/format';

type OrderStatus =
  | 'new'
  | 'contacted'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed' // Historical state from the previous implementation.
  | 'cancelled';
type Action = 'contact' | 'prepare' | 'ship' | 'deliver' | 'cancel';
type OrderItem = {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};
type OrderHistory = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
};
export type AdminOrderRequest = {
  id: string;
  reference: string;
  customer_name: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  note: string | null;
  status: OrderStatus;
  payment_status: 'not_collected';
  subtotal: number;
  created_at: string;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  inventory_deducted_at: string | null;
  inventory_restored_at: string | null;
  cancellation_reason: string | null;
  order_request_items: OrderItem[];
  order_request_status_history: OrderHistory[];
};

const STATUS: Record<OrderStatus, string> = {
  new: 'Yeni talep',
  contacted: 'Müşteriyle görüşüldü',
  processing: 'Hazırlanıyor',
  shipped: 'Kargoya verildi',
  delivered: 'Teslim edildi',
  completed: 'Eski kayıt · tamamlandı',
  cancelled: 'İptal edildi',
};

function dateTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AdminOrderRequests({
  requests,
  loadError,
}: {
  requests: AdminOrderRequest[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shipOrderId, setShipOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('tr-TR');
    return requests.filter(
      (order) =>
        (filter === 'all' || order.status === filter) &&
        (!text ||
          `${order.reference} ${order.customer_name} ${order.phone} ${order.city} ${order.district}`
            .toLocaleLowerCase('tr-TR')
            .includes(text)),
    );
  }, [requests, filter, query]);

  function closeForms() {
    setShipOrderId(null);
    setCancelOrderId(null);
    setCarrier('');
    setTrackingNumber('');
    setCancelReason('');
  }

  async function updateOrder(order: AdminOrderRequest, action: Action) {
    if (pending) return;
    if (
      action === 'prepare' &&
      !window.confirm(
        `${order.reference} talebi hazırlığa alınsın mı? Siparişteki ürünlerin stoğu şimdi düşecek. Bu işlem ödeme tahsilatı olarak kaydedilmez.`,
      )
    )
      return;
    if (
      action === 'deliver' &&
      !window.confirm(`${order.reference} siparişinin gerçekten teslim edildiğini onaylıyor musun?`)
    )
      return;
    if (
      action === 'cancel' &&
      !window.confirm(
        `${order.reference} siparişi iptal edilsin mi? Hazırlık aşamasında düşülen stok bir kez geri eklenecek.`,
      )
    )
      return;

    setPending(order.id);
    setError('');
    setSuccess('');
    try {
      const { error: dbError } = await createBrowserSupabase().rpc('manage_order_request', {
        p_order_id: order.id,
        p_action: action,
        p_carrier: action === 'ship' ? carrier.trim() : null,
        p_tracking_number: action === 'ship' ? trackingNumber.trim() : null,
        p_reason: action === 'cancel' ? cancelReason.trim() || null : null,
      });
      if (dbError) throw dbError;
      closeForms();
      setSuccess(`${order.reference}: Sipariş durumu güncellendi.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem gerçekleştirilemedi.');
    } finally {
      setPending(null);
    }
  }

  async function logout() {
    await createBrowserSupabase().auth.signOut();
    router.replace('/admin/giris');
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          öz kırtasiye<span>.</span>
        </Link>
        <div className="admin-sidegroup">
          <div className="admin-side-heading">YÖNETİM</div>
          <Link className="admin-side-link" href="/admin/urunler">
            <Boxes size={18} /> Ürün ve stok
          </Link>
          <Link className="admin-side-link" href="/admin/kategoriler">
            <FolderTree size={18} /> Kategoriler
          </Link>
          <Link className="admin-side-link active" href="/admin/siparisler">
            <ClipboardList size={18} /> Sipariş talepleri
          </Link>
          <Link className="admin-side-link" href="/admin/ayarlar">
            <Settings2 size={18} /> İşletme ayarları
          </Link>
          <Link className="admin-side-link" href="/">
            <Package size={18} /> Mağazayı görüntüle
          </Link>
        </div>
        <div className="admin-side-footer">Supabase · Sipariş ve kargo takibi</div>
      </aside>

      <div className="admin-main">
        <div className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button className="admin-logout" onClick={() => void logout()}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
        <div className="admin-body">
          <div className="admin-page-heading">
            <div>
              <span className="section-eyebrow">ÖZ KIRTASİYE · OPERASYON</span>
              <h1>
                Sipariş yönetimi<span className="orange-dot">.</span>
              </h1>
              <p>Sipariş talebi, stok hazırlığı ve kargo sürecini tek ekrandan yönet.</p>
            </div>
          </div>
          <div className="order-operation-notice">
            <Clock3 size={19} />
            <span>
              <strong>Online ödeme bağlı değil.</strong> Buradaki siparişler ödeme talebi
              niteliğindedir; “hazırlanıyor” veya “teslim edildi” durumları tahsilat yapmaz. PayTR
              daha sonra ayrı entegre edilecek.
            </span>
          </div>
          {loadError && (
            <p className="admin-form-error" role="alert">
              Siparişler yüklenemedi: {loadError}
            </p>
          )}
          {error && (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="admin-form-success" role="status">
              {success}
            </p>
          )}

          <div className="admin-stats">
            <div>
              <ClipboardList size={22} />
              <span>Son 100 talep</span>
              <strong>{requests.length}</strong>
            </div>
            <div>
              <PhoneCall size={22} />
              <span>Görüşme bekleyen</span>
              <strong>{requests.filter((o) => o.status === 'new').length}</strong>
            </div>
            <div>
              <PackageCheck size={22} />
              <span>Hazırlanıyor</span>
              <strong>{requests.filter((o) => o.status === 'processing').length}</strong>
            </div>
            <div>
              <Truck size={22} />
              <span>Kargoda</span>
              <strong>{requests.filter((o) => o.status === 'shipped').length}</strong>
            </div>
          </div>

          <div className="admin-content-box">
            <div className="order-filter-bar">
              <label className="admin-filter-label">
                Durum
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as typeof filter)}
                >
                  <option value="all">Tüm siparişler</option>
                  {(Object.keys(STATUS) as OrderStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {STATUS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="order-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sipariş no, müşteri veya telefon"
                />
              </label>
            </div>

            {!filtered.length && (
              <div className="admin-no-results">
                <ClipboardList size={38} />
                <h3>Bu filtrede sipariş bulunamadı.</h3>
              </div>
            )}
            <div className="order-request-list">
              {filtered.map((order) => (
                <article className="order-request-card" key={order.id}>
                  <div className="order-request-heading">
                    <div>
                      <strong>{order.reference}</strong>
                      <small>{dateTime(order.created_at)}</small>
                    </div>
                    <span className={`order-request-status status-${order.status}`}>
                      {STATUS[order.status]}
                    </span>
                  </div>
                  <div className="order-request-info">
                    <div>
                      <span>Müşteri</span>
                      <strong>{order.customer_name}</strong>
                      <a href={`tel:${order.phone}`}>{order.phone}</a>
                    </div>
                    <div>
                      <span>Teslimat adresi</span>
                      <strong>
                        {order.city} / {order.district}
                      </strong>
                      <p>{order.address}</p>
                    </div>
                    <div>
                      <span>Ürün toplamı</span>
                      <strong>{formatPrice(order.subtotal)}</strong>
                      <small>Ödeme kaydı: Tahsil edilmedi · Kargo hariç</small>
                    </div>
                  </div>
                  <div className="order-request-items">
                    {order.order_request_items.map((item) => (
                      <div key={item.id}>
                        <span>
                          {item.product_name} × {item.quantity}
                        </span>
                        <b>{formatPrice(item.line_total)}</b>
                      </div>
                    ))}
                  </div>
                  {order.note && (
                    <p className="order-request-note">
                      <strong>Müşteri notu:</strong> {order.note}
                    </p>
                  )}
                  {order.carrier && (
                    <p className="order-shipping-detail">
                      <Truck size={17} />
                      <strong>{order.carrier}</strong>{' '}
                      <span>
                        Takip no: <b>{order.tracking_number}</b>
                      </span>
                      {order.shipped_at && <small>{dateTime(order.shipped_at)}</small>}
                    </p>
                  )}
                  {order.inventory_restored_at && (
                    <p className="order-stock-restored">
                      <RotateCcw size={16} /> Sipariş iptalinde stok iade edildi ·{' '}
                      {dateTime(order.inventory_restored_at)}
                    </p>
                  )}
                  {order.cancellation_reason && (
                    <p className="order-request-note">
                      <strong>İptal gerekçesi:</strong> {order.cancellation_reason}
                    </p>
                  )}

                  <div className="order-request-actions">
                    {order.status === 'new' && (
                      <button
                        disabled={!!pending}
                        className="button button-primary"
                        onClick={() => void updateOrder(order, 'contact')}
                      >
                        <PhoneCall size={16} /> Müşteriyle görüşüldü
                      </button>
                    )}
                    {order.status === 'contacted' && (
                      <button
                        disabled={!!pending}
                        className="button button-primary"
                        onClick={() => void updateOrder(order, 'prepare')}
                      >
                        <Package size={16} /> Hazırlığa al · Stoktan düş
                      </button>
                    )}
                    {order.status === 'processing' && (
                      <button
                        disabled={!!pending}
                        className="button button-primary"
                        onClick={() => {
                          setShipOrderId(shipOrderId === order.id ? null : order.id);
                          setCancelOrderId(null);
                          setError('');
                        }}
                      >
                        <Truck size={16} /> Kargoya ver
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button
                        disabled={!!pending}
                        className="button button-primary"
                        onClick={() => void updateOrder(order, 'deliver')}
                      >
                        <CheckCircle2 size={16} /> Teslim edildi
                      </button>
                    )}
                    {(['new', 'contacted', 'processing'] as OrderStatus[]).includes(
                      order.status,
                    ) && (
                      <button
                        disabled={!!pending}
                        className="button button-outline"
                        onClick={() => {
                          setCancelOrderId(cancelOrderId === order.id ? null : order.id);
                          setShipOrderId(null);
                          setError('');
                        }}
                      >
                        <XCircle size={16} />{' '}
                        {order.status === 'processing' ? 'İptal + stok iadesi' : 'Talebi iptal et'}
                      </button>
                    )}
                  </div>

                  {shipOrderId === order.id && order.status === 'processing' && (
                    <form
                      className="order-action-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void updateOrder(order, 'ship');
                      }}
                    >
                      <strong>Kargo bilgileri</strong>
                      <div className="order-form-fields">
                        <label>
                          Kargo firması
                          <input
                            required
                            maxLength={60}
                            minLength={2}
                            value={carrier}
                            onChange={(event) => setCarrier(event.target.value)}
                            placeholder="Örn. Yurtiçi Kargo"
                          />
                        </label>
                        <label>
                          Takip numarası
                          <input
                            required
                            minLength={3}
                            maxLength={80}
                            pattern="[a-zA-Z0-9_-]{3,80}"
                            value={trackingNumber}
                            onChange={(event) => setTrackingNumber(event.target.value)}
                            placeholder="Örn. YK123456789"
                          />
                        </label>
                      </div>
                      <div className="order-form-footer">
                        <button
                          className="button button-outline"
                          type="button"
                          onClick={closeForms}
                        >
                          Vazgeç
                        </button>
                        <button
                          disabled={!!pending}
                          className="button button-primary"
                          type="submit"
                        >
                          Kargoya verildi olarak kaydet
                        </button>
                      </div>
                    </form>
                  )}
                  {cancelOrderId === order.id &&
                    (['new', 'contacted', 'processing'] as OrderStatus[]).includes(
                      order.status,
                    ) && (
                      <form
                        className="order-action-form order-cancel-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void updateOrder(order, 'cancel');
                        }}
                      >
                        <strong>İptal işlemi</strong>
                        <p>
                          {order.status === 'processing'
                            ? 'Bu sipariş hazırlanırken stoktan düşülmüştü. İptal edilirse ürünler stoğa otomatik ve yalnızca bir kez iade edilir.'
                            : 'Bu sipariş için stok düşülmediğinden iade hareketi oluşturulmaz.'}
                        </p>
                        <label>
                          İptal gerekçesi {order.status === 'processing' && '(zorunlu)'}
                          <textarea
                            rows={2}
                            minLength={order.status === 'processing' ? 3 : undefined}
                            maxLength={300}
                            required={order.status === 'processing'}
                            value={cancelReason}
                            onChange={(event) => setCancelReason(event.target.value)}
                            placeholder="Örn. Müşteri siparişi iptal etti"
                          />
                        </label>
                        <div className="order-form-footer">
                          <button
                            className="button button-outline"
                            type="button"
                            onClick={closeForms}
                          >
                            Vazgeç
                          </button>
                          <button
                            disabled={!!pending}
                            className="button button-outline"
                            type="submit"
                          >
                            İptali onayla
                          </button>
                        </div>
                      </form>
                    )}

                  <details className="order-timeline">
                    <summary>
                      <Clock3 size={15} /> İşlem geçmişi (
                      {order.order_request_status_history.length})
                    </summary>
                    {order.order_request_status_history.length === 0 ? (
                      <p>
                        Bu talep eski sistemde kaydedilmiş olabilir; geçmiş adımları henüz kayıtlı
                        değil.
                      </p>
                    ) : (
                      <ol>
                        {order.order_request_status_history.map((entry) => (
                          <li key={entry.id}>
                            <span>
                              <strong>
                                {STATUS[entry.to_status as OrderStatus] ?? entry.to_status}
                              </strong>
                              <small>{dateTime(entry.created_at)}</small>
                            </span>
                            {entry.note && <p>{entry.note}</p>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </details>
                  {order.status === 'completed' && (
                    <p className="order-legacy-note">
                      Bu eski sürümde tamamlanmış bir taleptir. Stoğu önceden düşülmüştür. Çifte
                      stok işlemini önlemek için yeni iş akışına otomatik aktarılmadı.
                    </p>
                  )}
                  {order.status === 'shipped' && (
                    <p className="order-legacy-note">
                      Kargoya verilmiş ürünün iptali ve stok iadesi burada yapılmaz. Fiziksel iade
                      teslim alındıktan sonra ayrı iade süreci gerekir.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
          <p className="admin-category-help">
            Stok yalnızca “Hazırlığa al” adımında düşer. Hazırlık aşamasındaki sipariş iptal
            edilirse stok otomatik geri eklenir. Kargoya verilmiş ve teslim edilmiş siparişler için
            otomatik stok iadesi yapılmaz. Ödeme tahsilatı veya PayTR iadesi bu ekranda yapılmaz.
          </p>
        </div>
      </div>
    </div>
  );
}
