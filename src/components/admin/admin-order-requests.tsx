'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  FolderTree,
  LogOut,
  Package,
  PhoneCall,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { formatPrice } from '@/lib/format';

type OrderStatus = 'new' | 'contacted' | 'completed' | 'cancelled';
type OrderItem = {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};
type OrderRequest = {
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
  order_request_items: OrderItem[];
};

const STATUS: Record<OrderStatus, string> = {
  new: 'Yeni talep',
  contacted: 'Müşteriyle görüşüldü',
  completed: 'Tamamlandı — stok düşüldü',
  cancelled: 'İptal edildi',
};

export function AdminOrderRequests({
  requests,
  loadError,
}: {
  requests: OrderRequest[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const filtered = useMemo(
    () => requests.filter((item) => filter === 'all' || item.status === filter),
    [requests, filter],
  );
  const newCount = requests.filter((order) => order.status === 'new').length;
  const contactedCount = requests.filter((order) => order.status === 'contacted').length;

  async function updateStatus(order: OrderRequest, status: OrderStatus) {
    if (pending || order.status === status) return;
    const confirmation =
      status === 'completed'
        ? `${order.reference} numaralı talebin gerçek hayatta karşılandığını ve ürünlerin teslim edildiğini onaylıyor musun? Bu işlem stoktan otomatik düşecektir.`
        : status === 'cancelled'
          ? `${order.reference} talebi iptal edilsin mi?`
          : null;
    if (confirmation && !window.confirm(confirmation)) return;
    setPending(order.id);
    setError('');
    setSuccess('');
    try {
      const { error: dbError } = await createBrowserSupabase().rpc('update_order_request_status', {
        p_order_id: order.id,
        p_status: status,
      });
      if (dbError) throw dbError;
      setSuccess(`${order.reference}: ${STATUS[status]}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Durum güncellenemedi.');
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
          <Link className="admin-side-link" href="/">
            <Package size={18} /> Mağazayı görüntüle
          </Link>
        </div>
        <div className="admin-side-footer">Supabase · Sipariş talep kayıtları</div>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button className="admin-logout" onClick={logout}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
        <div className="admin-body">
          <div className="admin-page-heading">
            <div>
              <span className="section-eyebrow">ÖZ KIRTASİYE · SİPARİŞ TALEPLERİ</span>
              <h1>
                Sipariş talepleri<span className="orange-dot">.</span>
              </h1>
              <p>
                Online ödeme henüz bağlı değil. Burada ödeme alınmış siparişler değil, iletişim
                talepleri listelenir.
              </p>
            </div>
          </div>
          {loadError && (
            <p className="admin-form-error" role="alert">
              Sipariş tablosu yüklenemedi: {loadError}. SQL migration dosyasının uygulanıp
              uygulanmadığını kontrol edin.
            </p>
          )}
          {error && (
            <p role="alert" className="admin-form-error">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="admin-form-success">
              {success}
            </p>
          )}
          <div className="admin-stats">
            <div>
              <ClipboardList size={22} />
              <span>Toplam talep</span>
              <strong>{requests.length}</strong>
            </div>
            <div>
              <Package size={22} />
              <span>Yeni talep</span>
              <strong>{newCount}</strong>
            </div>
            <div>
              <PhoneCall size={22} />
              <span>Görüşülen</span>
              <strong>{contactedCount}</strong>
            </div>
          </div>
          <div className="admin-content-box">
            <div className="admin-toolbar">
              <label className="admin-filter-label">
                Durum filtresi{' '}
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as typeof filter)}
                >
                  <option value="all">Tüm talepler</option>
                  {(Object.keys(STATUS) as OrderStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {STATUS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <small>Son 100 talep listelenir</small>
            </div>
            {!filtered.length && (
              <div className="admin-no-results">
                <ClipboardList size={38} />
                <h3>Bu filtrede sipariş talebi yok.</h3>
              </div>
            )}
            <div className="order-request-list">
              {filtered.map((order) => (
                <article className="order-request-card" key={order.id}>
                  <div className="order-request-heading">
                    <div>
                      <strong>{order.reference}</strong>
                      <small>{new Date(order.created_at).toLocaleString('tr-TR')}</small>
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
                      <span>Teslimat</span>
                      <strong>
                        {order.city} / {order.district}
                      </strong>
                      <p>{order.address}</p>
                    </div>
                    <div>
                      <span>Tahmini ürün toplamı</span>
                      <strong>{formatPrice(order.subtotal)}</strong>
                      <small>Ödeme alınmadı, kargo hariç</small>
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
                  {order.status === 'new' && (
                    <div className="order-request-actions">
                      <button
                        disabled={!!pending}
                        className="button button-outline"
                        onClick={() => void updateStatus(order, 'contacted')}
                      >
                        Müşteriyle görüşüldü
                      </button>
                      <button
                        disabled={!!pending}
                        className="button button-outline"
                        onClick={() => void updateStatus(order, 'cancelled')}
                      >
                        İptal
                      </button>
                    </div>
                  )}
                  {order.status === 'contacted' && (
                    <div className="order-request-actions">
                      <button
                        disabled={!!pending}
                        className="button button-primary"
                        onClick={() => void updateStatus(order, 'completed')}
                      >
                        Gerçekleştirildi — stoku düş
                      </button>
                      <button
                        disabled={!!pending}
                        className="button button-outline"
                        onClick={() => void updateStatus(order, 'cancelled')}
                      >
                        İptal
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
          <p className="admin-category-help">
            Önemli: Talebin tamamlanması, mağazanın müşteriye ürünleri gerçekten teslim ettiği
            anlamına gelir. Bu işlem stoktan atomik olarak düşer; geri alınamaz. Yeni taleplerde
            stok rezerve edilmez.
          </p>
        </div>
      </div>
    </div>
  );
}
