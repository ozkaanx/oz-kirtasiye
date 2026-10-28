'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Clock3, PhoneCall, PackageCheck, Truck } from 'lucide-react';

import filterStyles from './admin-list-filters.module.css';

import {
  type AdminOrderRequest,
  type OrderAction as Action,
  type OrderActionDetails,
} from '@/lib/admin-orders';
import { OrderSearchFilters } from './order-search-filters';
import {
  orderCursor,
  orderSearchHref,
  type OrderSearch,
  type OrderSearchResult,
} from '@/lib/admin-order-search';
import { OrderRequestCard } from './order-request-card';
export type { AdminOrderRequest } from '@/lib/admin-orders';

export function AdminOrderRequests({
  result,
  search,
  loadError,
}: {
  result: OrderSearchResult | null;
  search: OrderSearch;
  loadError: string | null;
}) {
  const router = useRouter();
  const requests = result?.rows ?? [];
  const [pending, setPending] = useState<string | null>(null);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeForm, setActiveForm] = useState<{ orderId: string; kind: 'ship' | 'cancel' } | null>(
    null,
  );

  async function updateOrder(
    order: AdminOrderRequest,
    action: Action,
    details: OrderActionDetails,
  ): Promise<boolean> {
    if (submitting.current) return false;
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

    submitting.current = true;
    setPending(order.id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/order-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action, ...details }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'İşlem gerçekleştirilemedi.');
      setSuccess(`${order.reference}: Sipariş durumu güncellendi.`);
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem gerçekleştirilemedi.');
      return false;
    } finally {
      submitting.current = false;
      setPending(null);
    }
  }

  return (
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
          niteliğindedir; “hazırlanıyor” veya “teslim edildi” durumları tahsilat yapmaz. PayTR daha
          sonra ayrı entegre edilecek.
        </span>
      </div>
      {loadError && (
        <p className="admin-form-error" role="alert">
          {loadError}
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

      {result && (
        <div className="admin-stats">
          <div>
            <ClipboardList size={22} />
            <span>Toplam talep</span>
            <strong>{result.stats.total}</strong>
          </div>
          <div>
            <PhoneCall size={22} />
            <span>Görüşme bekleyen</span>
            <strong>{result.stats.new}</strong>
          </div>
          <div>
            <PackageCheck size={22} />
            <span>Hazırlanıyor</span>
            <strong>{result.stats.processing}</strong>
          </div>
          <div>
            <Truck size={22} />
            <span>Kargoda</span>
            <strong>{result.stats.shipped}</strong>
          </div>
        </div>
      )}

      <div className="admin-content-box">
        <OrderSearchFilters search={search} />
        {result && (
          <p className={filterStyles.result}>
            Bu sayfada {requests.length} sipariş · Filtrelere uyan toplam {result.total} kayıt.
            Tarihler İstanbul saatine göredir.
          </p>
        )}
        {loadError && (
          <button className="button button-secondary" onClick={() => router.refresh()}>
            Tekrar dene
          </button>
        )}
        {result && !requests.length && (
          <div className="admin-no-results">
            <ClipboardList size={38} />
            <h3>Bu sayfada sipariş bulunamadı.</h3>
            <Link href={orderSearchHref(search)}>İlk sayfaya dön</Link>
          </div>
        )}
        <div className="order-request-list">
          {requests.map((order) => (
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
        {result && requests.length > 0 && (
          <nav aria-label="Sipariş sayfaları" className={filterStyles.pagination}>
            {result.hasPrevious && (
              <Link
                className="button button-secondary"
                href={orderSearchHref(search, {
                  direction: 'before',
                  value: orderCursor(requests[0]),
                })}
              >
                Önceki sayfa
              </Link>
            )}
            {result.hasNext && (
              <Link
                className="button button-secondary"
                href={orderSearchHref(search, {
                  direction: 'after',
                  value: orderCursor(requests[requests.length - 1]),
                })}
              >
                Sonraki sayfa
              </Link>
            )}
          </nav>
        )}
      </div>
      <p className="admin-category-help">
        Stok yalnızca “Hazırlığa al” adımında düşer. Hazırlık aşamasındaki sipariş iptal edilirse
        stok otomatik geri eklenir. Kargoya verilmiş ve teslim edilmiş siparişler için otomatik stok
        iadesi yapılmaz. Ödeme tahsilatı veya PayTR iadesi bu ekranda yapılmaz.
      </p>
    </div>
  );
}
