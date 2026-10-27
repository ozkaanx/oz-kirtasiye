'use client';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { cartLineKey, type CartLine, type CartProduct } from '@/lib/cart-types';
import { formatPrice } from '@/lib/format';
import type { CartPricing, DeliveryMethod } from '@/lib/delivery';
import type { CouponQuote } from '@/lib/coupon';
import { CouponBox } from '@/components/coupons/coupon-box';
type Props = {
  cart: CartLine[];
  products: Record<string, CartProduct>;
  cartLoading: boolean;
  method: DeliveryMethod;
  pricing: CartPricing;
  promo: { quote: CouponQuote | null; error: string; loading: boolean };
};
export function CheckoutSummary({ cart, products, cartLoading, method, pricing, promo }: Props) {
  return (
    <aside className="checkout-summary">
      <h2>Sepet özeti</h2>
      {cartLoading ? (
        <p>Ürünler kontrol ediliyor...</p>
      ) : !cart.length ? (
        <p>
          Sepetin boş. <Link href="/urunler">Ürün seç.</Link>
        </p>
      ) : null}
      {cart.map((line) => {
        const product = products[cartLineKey(line.productId, line.variantId)];
        return (
          <div key={cartLineKey(line.productId, line.variantId)} className="checkout-summary-line">
            {product?.imageUrl ? (
              <img src={product.imageUrl} alt="" />
            ) : (
              <Package size={31} color="#9ba3ae" />
            )}
            <div>
              <strong>{product?.name || 'Ürün bulunamadı'}</strong>
              {product?.variantLabel && <small>{product.variantLabel}</small>}
              <small>
                {line.quantity} adet{' '}
                {product && line.quantity > product.stock_quantity ? '— stok yetersiz' : ''}
              </small>
            </div>
            <b>{product ? formatPrice(product.price * line.quantity) : '—'}</b>
          </div>
        );
      })}
      <CouponBox {...promo} />
      <div className="delivery-summary-row">
        <span>Ürünler</span>
        <b>{formatPrice(pricing.subtotal)}</b>
      </div>
      {promo.quote && pricing.discountAmount > 0 && (
        <div className="delivery-summary-row">
          <span>
            {promo.quote.code
              ? `Kupon indirimi (${promo.quote.code})`
              : `Kampanya indirimi (${promo.quote.campaignName})`}
          </span>
          <b>−{formatPrice(pricing.discountAmount)}</b>
        </div>
      )}
      <div className="delivery-summary-row">
        <span>{method === 'pickup' ? 'Mağazadan teslim' : 'Kargo bedeli'}</span>
        <b>{pricing.shippingFee === null ? 'Mevcut değil' : formatPrice(pricing.shippingFee)}</b>
      </div>
      <div className="checkout-total">
        <span>Tahmini toplam</span>
        <strong>{pricing.total === null ? '—' : formatPrice(pricing.total)}</strong>
      </div>
      {method === 'shipping' && pricing.freeShippingRemaining !== null && (
        <small>Ücretsiz kargoya {formatPrice(pricing.freeShippingRemaining)} kaldı.</small>
      )}
      <small>
        Ürün fiyatları, stok ve kargo tutarı talep gönderilirken yeniden doğrulanır. Ödeme alınmaz.
      </small>
    </aside>
  );
}
