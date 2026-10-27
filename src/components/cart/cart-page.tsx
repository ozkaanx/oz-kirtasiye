'use client';

import { cartLineKey } from '@/lib/cart-types';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  LockKeyhole,
} from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { formatPrice } from '@/lib/format';
import { deliveryQuote, type DeliverySettings } from '@/lib/delivery';
import { CouponBox } from '@/components/coupons/coupon-box';
import { FreeShippingProgress } from '@/components/cart/free-shipping-progress';
import { useCartPricing } from '@/components/coupons/use-cart-pricing';

export function CartPage({ settings }: { settings: DeliverySettings }) {
  const {
    cart,
    products,
    cartLoading,
    cartError,
    cartIsValid,
    setQuantity,
    removeFromCart,
    cartSubtotal,
    refreshCart,
  } = useShop();
  const method = deliveryQuote(settings, cartSubtotal, 'shipping').available
    ? 'shipping'
    : 'pickup';
  const { promo, pricing } = useCartPricing(settings, method);
  const shipping = deliveryQuote(settings, pricing.netSubtotal, 'shipping');
  const pickup = deliveryQuote(settings, pricing.netSubtotal, 'pickup');
  const anyDelivery = shipping.available || pickup.available;
  const couponBlocked = pricing.couponBlocked;
  return (
    <div className="container-wide basket-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link> › Sepetim
      </div>
      <h1>
        Sepetim<span className="orange-dot">.</span>
      </h1>
      {!cart.length ? (
        <div className="empty-page">
          <ShoppingBag size={48} />
          <h2>Sepetin henüz boş</h2>
          <p>Yeni fikirlerin için ilk ürünü seçmeye ne dersin?</p>
          <Link className="button button-primary" href="/urunler">
            Ürünlere göz at <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="basket-layout">
          <section className="basket-items">
            <div className="basket-items-title">
              <strong>Sepetindeki ürünler ({cart.reduce((s, l) => s + l.quantity, 0)})</strong>
              <Link href="/urunler">
                Alışverişe devam et <ArrowRight size={16} />
              </Link>
            </div>
            {cartLoading && (
              <p className="cart-loading">Ürün fiyatları ve stok kontrol ediliyor...</p>
            )}
            {cartError && (
              <p role="alert" className="admin-form-error">
                {cartError} <button onClick={() => void refreshCart()}>Yenile</button>
              </p>
            )}
            {cart.map((line) => {
              const product = products[cartLineKey(line.productId, line.variantId)];
              return (
                <div key={cartLineKey(line.productId, line.variantId)} className="basket-item">
                  <div className="basket-image">
                    {product?.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <Package size={55} color="#a9afb9" />
                    )}
                  </div>
                  <div className="basket-item-info">
                    {product ? (
                      <Link href={`/magaza/urun/${product.slug}`}>{product.name}</Link>
                    ) : (
                      <strong>Ürün yayından kaldırılmış</strong>
                    )}
                    {product && (
                      <small>
                        {product.variantLabel ? `${product.variantLabel} · ` : ''}
                        {product.stock_quantity} adet stokta
                      </small>
                    )}
                    {product && <strong>{formatPrice(product.price)}</strong>}
                    {product && line.quantity > product.stock_quantity && (
                      <small role="alert" className="cart-stock-warning">
                        Stok yetersiz; miktarı azaltın.
                      </small>
                    )}
                  </div>
                  <div className="basket-item-actions">
                    <div className="quantity-picker">
                      <button
                        aria-label="Bir azalt"
                        onClick={() =>
                          setQuantity(line.productId, line.quantity - 1, line.variantId)
                        }
                      >
                        <Minus size={15} />
                      </button>
                      <b>{line.quantity}</b>
                      <button
                        aria-label="Bir artır"
                        onClick={() =>
                          setQuantity(line.productId, line.quantity + 1, line.variantId)
                        }
                        disabled={
                          line.quantity >= 99 || !product || line.quantity >= product.stock_quantity
                        }
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <button
                      className="remove-line"
                      aria-label="Ürünü sil"
                      onClick={() => removeFromCart(line.productId, line.variantId)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
          <aside className="basket-summary">
            <h2>Sipariş özeti</h2>
            <div>
              <span>Ürünler toplamı</span>
              <b>{formatPrice(pricing.subtotal)}</b>
            </div>
            <div>
              <span>Kargo ile gönderim</span>
              <span>
                {shipping.available && shipping.fee !== null
                  ? formatPrice(pricing.shippingFee ?? shipping.fee)
                  : 'Henüz aktif değil'}
              </span>
            </div>
            {pickup.available && (
              <div>
                <span>Mağazadan teslim</span>
                <b>Ücretsiz</b>
              </div>
            )}
            <FreeShippingProgress
              subtotal={pricing.netSubtotal}
              threshold={settings.free_shipping_threshold}
              shippingAvailable={shipping.available}
              shippingFee={pricing.shippingFee}
            />
            <CouponBox {...promo} />
            {promo.quote && pricing.discountAmount > 0 && (
              <div>
                <span>
                  {promo.quote.code
                    ? `Kupon (${promo.quote.code})`
                    : `Kampanya (${promo.quote.campaignName})`}
                </span>
                <b>−{formatPrice(pricing.discountAmount)}</b>
              </div>
            )}
            <div className="basket-total">
              <span>{promo.quote ? 'İndirimli ürünler' : 'Ürünler toplamı'}</span>
              <strong>{formatPrice(pricing.netSubtotal)}</strong>
            </div>
            {shipping.available && shipping.total !== null && (
              <p className="delivery-cart-footnote">
                Kargo ile toplam: <strong>{formatPrice(pricing.total ?? shipping.total)}</strong>
                {shipping.freeShippingRemaining !== null &&
                  ` · Ücretsiz kargoya ${formatPrice(shipping.freeShippingRemaining)} kaldı.`}
              </p>
            )}
            {pickup.available && (
              <p className="delivery-cart-footnote">
                Mağazadan teslim seçilirse ek kargo bedeli olmaz.
              </p>
            )}
            {!anyDelivery && (
              <p role="status" className="delivery-cart-footnote">
                Henüz teslimat seçeneği aktif değil. Sipariş talebi kapalı.
              </p>
            )}
            <p>
              <LockKeyhole size={17} /> Ödeme işlemi bu aşamada yapılmaz. Sipariş talebiniz mağazaya
              iletilir.
            </p>
            <Link
              href="/siparis"
              className={`button button-primary${!cartIsValid || !anyDelivery || couponBlocked ? 'checkout-disabled' : ''}`}
              aria-disabled={!cartIsValid || !anyDelivery || couponBlocked}
              onClick={(event) => {
                if (!cartIsValid || !anyDelivery || couponBlocked) event.preventDefault();
              }}
            >
              Talep formuna geç <ArrowRight size={17} />
            </Link>
            <Link href="/urunler" className="basket-back">
              <ArrowLeft size={16} /> Alışverişe devam et
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
