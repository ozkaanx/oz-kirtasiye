'use client';
import { useState } from 'react';
import { PhoneCall, Package, Truck, CheckCircle2, XCircle } from 'lucide-react';
import type {
  AdminOrderRequest,
  OrderAction,
  OrderActionDetails,
  OrderFormKind,
  OrderStatus,
} from '@/lib/admin-orders';
export type OrderActionsProps = {
  order: AdminOrderRequest;
  pending: boolean;
  formKind: OrderFormKind;
  onFormChange: (kind: OrderFormKind) => void;
  onClearError: () => void;
  onAction: (
    order: AdminOrderRequest,
    action: OrderAction,
    details: OrderActionDetails,
  ) => Promise<boolean>;
};
export function OrderRequestActions({
  order,
  pending,
  formKind,
  onFormChange,
  onClearError,
  onAction,
}: OrderActionsProps) {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  function closeForms() {
    onFormChange(null);
    setCarrier('');
    setTrackingNumber('');
    setCancelReason('');
  }
  async function runAction(action: OrderAction) {
    if (await onAction(order, action, { carrier, trackingNumber, cancelReason })) closeForms();
  }
  return (
    <>
      {' '}
      <div className="order-request-actions">
        {order.status === 'new' && (
          <button
            disabled={!!pending}
            className="button button-primary"
            onClick={() => void runAction('contact')}
          >
            <PhoneCall size={16} /> Müşteriyle görüşüldü
          </button>
        )}
        {order.status === 'contacted' && (
          <button
            disabled={!!pending}
            className="button button-primary"
            onClick={() => void runAction('prepare')}
          >
            <Package size={16} /> Hazırlığa al · Stoktan düş
          </button>
        )}
        {order.status === 'processing' && order.delivery_method !== 'pickup' && (
          <button
            disabled={!!pending}
            className="button button-primary"
            onClick={() => {
              onFormChange(formKind === 'ship' ? null : 'ship');
              onClearError();
            }}
          >
            <Truck size={16} /> Kargoya ver
          </button>
        )}
        {order.status === 'processing' && order.delivery_method === 'pickup' && (
          <button
            disabled={!!pending}
            className="button button-primary"
            onClick={() => void runAction('pickup_collect')}
          >
            <CheckCircle2 size={16} /> Mağazadan teslim edildi
          </button>
        )}
        {order.status === 'shipped' && (
          <button
            disabled={!!pending}
            className="button button-primary"
            onClick={() => void runAction('deliver')}
          >
            <CheckCircle2 size={16} /> Teslim edildi
          </button>
        )}
        {(['new', 'contacted', 'processing'] as OrderStatus[]).includes(order.status) && (
          <button
            disabled={!!pending}
            className="button button-outline"
            onClick={() => {
              onFormChange(formKind === 'cancel' ? null : 'cancel');
              onClearError();
            }}
          >
            <XCircle size={16} />{' '}
            {order.status === 'processing' ? 'İptal + stok iadesi' : 'Talebi iptal et'}
          </button>
        )}
      </div>
      {formKind === 'ship' &&
        order.status === 'processing' &&
        order.delivery_method !== 'pickup' && (
          <form
            className="order-action-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction('ship');
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
              <button className="button button-outline" type="button" onClick={closeForms}>
                Vazgeç
              </button>
              <button disabled={!!pending} className="button button-primary" type="submit">
                Kargoya verildi olarak kaydet
              </button>
            </div>
          </form>
        )}
      {formKind === 'cancel' &&
        (['new', 'contacted', 'processing'] as OrderStatus[]).includes(order.status) && (
          <form
            className="order-action-form order-cancel-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction('cancel');
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
              <button className="button button-outline" type="button" onClick={closeForms}>
                Vazgeç
              </button>
              <button disabled={!!pending} className="button button-outline" type="submit">
                İptali onayla
              </button>
            </div>
          </form>
        )}
    </>
  );
}
