'use client';

import { cartLineKey } from '@/lib/cart-types';

import Link from 'next/link';
import { ArrowRight, Minus, Package, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useShop } from '@/context/shop-context';
import { formatPrice } from '@/lib/format';

export function CartDrawer() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const {
    cart,
    products,
    cartOpen,
    setCartOpen,
    setQuantity,
    removeFromCart,
    cartSubtotal,
    cartLoading,
    cartError,
    cartIsValid,
    refreshCart,
  } = useShop();

  useLayoutEffect(() => {
    if (!cartOpen) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [cartOpen, setCartOpen]);
  if (!cartOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="cart-overlay"
      aria-label="Alışveriş sepeti"
      onCancel={(event) => {
        event.preventDefault();
        setCartOpen(false);
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCartOpen(false);
      }}
    >
      <aside className="cart-drawer">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">GÜZEL SEÇİMLER!</span>
            <h2>
              Sepetim <span>({cart.reduce((n, item) => n + item.quantity, 0)})</span>
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={() => setCartOpen(false)}
            aria-label="Sepeti kapat"
          >
            <X size={22} />
          </button>
        </div>
        {!cart.length ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">
              <ShoppingBag size={43} />
            </div>
            <h3>Sepetin henüz boş</h3>
            <p>Biraz renk eklemeye ne dersin?</p>
            <Link
              className="button button-primary"
              href="/urunler"
              onClick={() => setCartOpen(false)}
            >
              Ürünlere göz at <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {cartLoading && <p className="cart-loading">Ürünler kontrol ediliyor...</p>}
              {cartError && (
                <p role="alert" className="admin-form-error">
                  {cartError} <button onClick={() => void refreshCart()}>Tekrar dene</button>
                </p>
              )}
              {cart.map((line) => {
                const product = products[cartLineKey(line.productId, line.variantId)];
                return (
                  <div className="cart-line" key={cartLineKey(line.productId, line.variantId)}>
                    <div className="cart-line-image">
                      {product?.imageUrl ? (
                        <img src={product.imageUrl} alt="" />
                      ) : (
                        <Package size={44} color="#adb5bf" />
                      )}
                    </div>
                    <div className="cart-line-detail">
                      {product ? (
                        <Link
                          href={`/magaza/urun/${product.slug}`}
                          onClick={() => setCartOpen(false)}
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <strong>
                          {cartLoading ? 'Ürün bilgileri yükleniyor…' : 'Ürün bulunamadı'}
                        </strong>
                      )}
                      {product && <small>{product.variantLabel}</small>}
                      {product && (
                        <span className="cart-line-price">{formatPrice(product.price)}</span>
                      )}
                      {product && line.quantity > product.stock_quantity && (
                        <small role="alert" className="cart-stock-warning">
                          En fazla {product.stock_quantity} adet mevcut.
                        </small>
                      )}
                      <div className="cart-line-controls">
                        <div className="quantity-picker">
                          <button
                            aria-label="Adedi azalt"
                            onClick={() =>
                              setQuantity(line.productId, line.quantity - 1, line.variantId)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <strong>{line.quantity}</strong>
                          <button
                            aria-label="Adedi artır"
                            disabled={
                              line.quantity >= 99 ||
                              (product ? line.quantity >= product.stock_quantity : true)
                            }
                            onClick={() =>
                              setQuantity(line.productId, line.quantity + 1, line.variantId)
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          className="remove-line"
                          aria-label="Ürünü sepetten çıkar"
                          onClick={() => removeFromCart(line.productId, line.variantId)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-checkout">
              <div className="cart-total">
                <span>Tahmini ara toplam</span>
                <strong>
                  {cartLoading
                    ? 'Hesaplanıyor…'
                    : cartError
                      ? 'Kontrol edilemedi'
                      : formatPrice(cartSubtotal)}
                </strong>
              </div>
              <p className="checkout-notice">
                Ödeme henüz açık değil. Sonraki adımda sipariş talebi bırakabilirsiniz; stok ve
                fiyat yeniden doğrulanır.
              </p>
              <Link
                href="/siparis"
                className={`button button-primary${!cartIsValid ? 'checkout-disabled' : ''}`}
                aria-disabled={!cartIsValid}
                onClick={(event) => {
                  if (!cartIsValid) event.preventDefault();
                  else setCartOpen(false);
                }}
              >
                Sipariş talebine geç <ArrowRight size={17} />
              </Link>
              <Link href="/sepet" className="cart-full-link" onClick={() => setCartOpen(false)}>
                Sepeti detaylı görüntüle
              </Link>
            </div>
          </>
        )}
      </aside>
    </dialog>
  );
}
