import { Clock3, RotateCcw, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import {
  ORDER_STATUS_LABELS as STATUS,
  orderDateTime as dateTime,
  type OrderStatus,
} from '@/lib/admin-orders';
import { OrderRequestActions, type OrderActionsProps } from './order-request-actions';
export function OrderRequestCard({
  order,
  pending,
  formKind,
  onFormChange,
  onClearError,
  onAction,
}: OrderActionsProps) {
  return (
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
          <span>{order.delivery_method === 'pickup' ? 'Mağazadan teslim' : 'Teslimat adresi'}</span>
          <strong>
            {order.delivery_method === 'pickup'
              ? 'Mağaza teslim noktası'
              : `${order.city} / ${order.district}`}
          </strong>
          <p>{order.address}</p>
        </div>
        <div>
          <span>Ürün toplamı</span>
          <strong>{formatPrice(order.subtotal)}</strong>
          {order.delivery_method !== 'legacy' && (
            <>
              {order.discount_amount > 0 && (
                <small>
                  {order.coupon_code
                    ? `Kupon (${order.coupon_code})`
                    : `Kampanya (${order.automatic_campaign_name})`}
                  : −{formatPrice(order.discount_amount)}
                </small>
              )}
              <small>Kargo: {formatPrice(order.shipping_fee)}</small>
              <strong>Genel toplam: {formatPrice(order.total)}</strong>
            </>
          )}
          <small>Ödeme kaydı: Tahsil edilmedi</small>
          {order.delivery_method === 'legacy' && (
            <small>Önceki sipariş · Kargo tutarı kaydedilmemiş</small>
          )}
        </div>
      </div>
      <div className="order-request-items">
        {order.order_request_items.map((item) => (
          <div key={item.id}>
            <span>
              {item.product_name}
              {item.variant_label ? ` — ${item.variant_label}` : ''} × {item.quantity}
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

      <OrderRequestActions
        order={order}
        pending={pending}
        formKind={formKind}
        onFormChange={onFormChange}
        onClearError={onClearError}
        onAction={onAction}
      />
      <details className="order-timeline">
        <summary>
          <Clock3 size={15} /> İşlem geçmişi ({order.order_request_status_history.length})
        </summary>
        {order.order_request_status_history.length === 0 ? (
          <p>Bu talep eski sistemde kaydedilmiş olabilir; geçmiş adımları henüz kayıtlı değil.</p>
        ) : (
          <ol>
            {order.order_request_status_history.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{STATUS[entry.to_status as OrderStatus] ?? entry.to_status}</strong>
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
          Bu eski sürümde tamamlanmış bir taleptir. Stoğu önceden düşülmüştür. Çifte stok işlemini
          önlemek için yeni iş akışına otomatik aktarılmadı.
        </p>
      )}
      {order.status === 'shipped' && (
        <p className="order-legacy-note">
          Kargoya verilmiş ürünün iptali ve stok iadesi burada yapılmaz. Fiziksel iade teslim
          alındıktan sonra ayrı iade süreci gerekir.
        </p>
      )}
    </article>
  );
}
