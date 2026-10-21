'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { useShop } from '@/context/shop-context';
import { getProductById } from '@/data/catalog';
import { formatPrice } from '@/lib/format';

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQuantity, removeFromCart, cartSubtotal } = useShop();
  useEffect(() => {
    if (!cartOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setCartOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [cartOpen, setCartOpen]);
  if (!cartOpen) return null;
  return (
    <div
      className="cart-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCartOpen(false);
      }}
    >
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Alışveriş sepeti">
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
        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">
              <ShoppingBag size={43} />
            </div>
            <h3>Sepetin henüz boş</h3>
            <p>Biraz renk eklemeye ne dersin?</p>
            <button className="button button-primary" onClick={() => setCartOpen(false)}>
              Ürünlere göz at <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {cart.map((line) => {
                const product = getProductById(line.productId);
                if (!product) return null;
                return (
                  <div className="cart-line" key={line.productId}>
                    <div className="cart-line-image" style={{ background: product.tint }}>
                      <Image src={product.image} alt="" width={90} height={90} />
                    </div>
                    <div className="cart-line-detail">
                      <Link href={`/urun/${product.slug}`} onClick={() => setCartOpen(false)}>
                        {product.name}
                      </Link>
                      <span className="cart-line-price">{formatPrice(product.price)}</span>
                      <div className="cart-line-controls">
                        <div className="quantity-picker">
                          <button
                            aria-label="Adedi azalt"
                            onClick={() => setQuantity(product.id, line.quantity - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <strong>{line.quantity}</strong>
                          <button
                            aria-label="Adedi artır"
                            disabled={line.quantity >= 99}
                            onClick={() => setQuantity(product.id, line.quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          className="remove-line"
                          aria-label="Ürünü sepetten çıkar"
                          onClick={() => removeFromCart(product.id)}
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
                <span>Ara toplam</span>
                <strong>{formatPrice(cartSubtotal)}</strong>
              </div>
              <p className="checkout-notice">
                Bu bir tasarım demosudur. Sipariş ve ödeme işlemleri henüz aktif değildir.
              </p>
              <button className="button button-primary checkout-disabled" disabled>
                Ödeme adımına geç <ArrowRight size={17} />
              </button>
              <Link href="/sepet" className="cart-full-link" onClick={() => setCartOpen(false)}>
                Sepeti detaylı görüntüle
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
