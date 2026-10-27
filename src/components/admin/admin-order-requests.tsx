'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  LogOut,
  Search,
  PhoneCall,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import filterStyles from './admin-list-filters.module.css';

import {
  ORDER_STATUS_LABELS as STATUS,
  type AdminOrderRequest,
  type OrderAction as Action,
  type OrderActionDetails,
  type OrderStatus,
} from '@/lib/admin-orders';
import { OrderRequestCard } from './order-request-card';
export type { AdminOrderRequest } from '@/lib/admin-orders';

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
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'shipping' | 'pickup' | 'legacy'>(
    'all',
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeForm, setActiveForm] = useState<{ orderId: string; kind: 'ship' | 'cancel' } | null>(
    null,
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('tr-TR');
    return requests.filter((order) => {
      if (filter !== 'all' && order.status !== filter) return false;
      if (deliveryFilter !== 'all' && order.delivery_method !== deliveryFilter) return false;
      if (
        text &&
        !`${order.reference} ${order.customer_name} ${order.phone} ${order.city} ${order.district} ${order.coupon_code ?? ''} ${order.automatic_campaign_name ?? ''}`
          .toLocaleLowerCase('tr-TR')
          .includes(text)
      )
        return false;
      const orderDay = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(order.created_at));
      if (dateFrom && orderDay < dateFrom) return false;
      if (dateTo && orderDay > dateTo) return false;
      return true;
    });
  }, [requests, filter, query, deliveryFilter, dateFrom, dateTo]);

  function clearOrderFilters() {
    setFilter('all');
    setQuery('');
    setDeliveryFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  async function updateOrder(
    order: AdminOrderRequest,
    action: Action,
    details: OrderActionDetails,
  ): Promise<boolean> {
    if (pending) return false;
    if (
      action === 'prepare' &&
      !window.confirm(
        `${order.reference} talebi hazırlığa alınsın mı? Siparişteki ürünlerin stoğu şimdi düşecek. Bu işlem ödeme tahsilatı olarak kaydedilmez.`,
      )
    )
      return false;
    if (
      (action === 'deliver' || action === 'pickup_collect') &&
      !window.confirm(`${order.reference} siparişinin gerçekten teslim edildiğini onaylıyor musun?`)
    )
      return false;
    if (
      action === 'cancel' &&
      !window.confirm(
        `${order.reference} siparişi iptal edilsin mi? Hazırlık aşamasında düşülen stok bir kez geri eklenecek.`,
      )
    )
      return false;

    setPending(order.id);
    setError('');
    setSuccess('');
    try {
      const { error: dbError } =
        action === 'pickup_collect'
          ? await createBrowserSupabase().rpc('complete_pickup_order', { p_order_id: order.id })
          : await createBrowserSupabase().rpc('manage_order_request', {
              p_order_id: order.id,
              p_action: action,
              p_carrier: action === 'ship' ? details.carrier.trim() : null,
              p_tracking_number: action === 'ship' ? details.trackingNumber.trim() : null,
              p_reason: action === 'cancel' ? details.cancelReason.trim() || null : null,
            });
      if (dbError) throw dbError;
      setSuccess(`${order.reference}: Sipariş durumu güncellendi.`);
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem gerçekleştirilemedi.');
      return false;
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
      <AdminSidebar />

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
                  aria-label="Sipariş numarası, müşteri veya telefon ara"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sipariş no, müşteri veya telefon"
                />
              </label>
            </div>
            <div className={filterStyles.filters}>
              <label className={filterStyles.field}>
                Teslimat şekli
                <select
                  value={deliveryFilter}
                  onChange={(event) =>
                    setDeliveryFilter(event.target.value as typeof deliveryFilter)
                  }
                >
                  <option value="all">Tüm teslimatlar</option>
                  <option value="shipping">Kargo ile</option>
                  <option value="pickup">Mağazadan teslim</option>
                  <option value="legacy">Eski kayıtlar</option>
                </select>
              </label>
              <label className={filterStyles.field}>
                Başlangıç tarihi
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className={filterStyles.field}>
                Bitiş tarihi
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              <button type="button" className={filterStyles.reset} onClick={clearOrderFilters}>
                Filtreleri temizle
              </button>
            </div>
            <p className={filterStyles.result}>
              {filtered.length} / {requests.length} sipariş görüntüleniyor. Filtreler yüklenen son
              100 kayıt üzerinde çalışır.
            </p>

            {!filtered.length && (
              <div className="admin-no-results">
                <ClipboardList size={38} />
                <h3>Bu filtrede sipariş bulunamadı.</h3>
              </div>
            )}
            <div className="order-request-list">
              {filtered.map((order) => (
                <OrderRequestCard
                  key={order.id}
                  order={order}
                  pending={!!pending}
                  formKind={activeForm?.orderId === order.id ? activeForm.kind : null}
                  onFormChange={(kind) => setActiveForm(kind ? { orderId: order.id, kind } : null)}
                  onClearError={() => setError('')}
                  onAction={updateOrder}
                />
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
