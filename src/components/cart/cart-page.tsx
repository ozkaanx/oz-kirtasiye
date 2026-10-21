'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, LockKeyhole } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { getProductById } from '@/data/catalog';
import { formatPrice } from '@/lib/format';
export function CartPage() {
  const { cart, setQuantity, removeFromCart, cartSubtotal } = useShop();
  return (
    <div className="container-wide basket-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link> › Sepetim
      </div>
      <h1>
        Sepetim<span className="orange-dot">.</span>
      </h1>
      {cart.length === 0 ? (
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
            {cart.map((line) => {
              const p = getProductById(line.productId);
              if (!p) return null;
              return (
                <div key={p.id} className="basket-item">
                  <Link
                    href={`/urun/${p.slug}`}
                    className="basket-image"
                    style={{ background: p.tint }}
                  >
                    <Image src={p.image} alt={p.name} width={110} height={110} />
                  </Link>
                  <div className="basket-item-info">
                    <Link href={`/urun/${p.slug}`}>{p.name}</Link>
                    <small>Örnek ürün</small>
                    <strong>{formatPrice(p.price)}</strong>
                  </div>
                  <div className="basket-item-actions">
                    <div className="quantity-picker">
                      <button
                        aria-label="Bir azalt"
                        onClick={() => setQuantity(p.id, line.quantity - 1)}
                      >
                        <Minus size={15} />
                      </button>
                      <b>{line.quantity}</b>
                      <button
                        aria-label="Bir artır"
                        onClick={() => setQuantity(p.id, line.quantity + 1)}
                        disabled={line.quantity >= 99}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <button
                      className="remove-line"
                      aria-label="Ürünü sil"
                      onClick={() => removeFromCart(p.id)}
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
              <b>{formatPrice(cartSubtotal)}</b>
            </div>
            <div>
              <span>Kargo ücreti</span>
              <span>Ödeme aşamasında</span>
            </div>
            <div className="basket-total">
              <span>Ara toplam</span>
              <strong>{formatPrice(cartSubtotal)}</strong>
            </div>
            <p>
              <LockKeyhole size={17} /> Şu anda demo sürümündesin. Ödeme alma ve sipariş oluşturma
              kapalıdır.
            </p>
            <button type="button" disabled className="button button-primary">
              Ödemeye geç <ArrowRight size={17} />
            </button>
            <Link href="/urunler" className="basket-back">
              <ArrowLeft size={16} /> Alışverişe devam et
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
