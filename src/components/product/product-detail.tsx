'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { categories, products } from '@/data/catalog';
import { formatPrice } from '@/lib/format';
import { useShop } from '@/context/shop-context';
import { ProductCard } from '@/components/product/product-card';
import type { Product } from '@/types/shop';
export function ProductDetail({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'details'>('description');
  const { addToCart, toggleFavorite, favorites } = useShop();
  const liked = favorites.includes(product.id);
  const category = categories.find((c) => c.id === product.category);
  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);
  return (
    <div className="container-wide detail-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link>
        <ChevronRight size={14} />
        <Link href="/urunler">Ürünler</Link>
        <ChevronRight size={14} />
        <Link href={`/urunler?category=${product.category}`}>{category?.label}</Link>
        <ChevronRight size={14} />
        {product.name}
      </div>
      <div className="detail-grid">
        <div className="detail-media">
          <div className="detail-main-image" style={{ background: product.tint }}>
            <Image src={product.image} width={600} height={560} priority alt={product.name} />
            {product.badge && <span className="product-badge">{product.badge}</span>}
          </div>
          <div className="detail-thumbnail-row">
            <div className="selected-thumbnail" style={{ background: product.tint }}>
              <Image src={product.image} alt="Ürün görseli" width={66} height={66} />
            </div>
            <span>Temsili ürün görseli</span>
          </div>
        </div>
        <div className="detail-info">
          <span className="detail-category">{category?.label}</span>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <div className="detail-divider" />
          <div className="detail-price-row">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
          </div>
          <p className="detail-small-print">
            Fiyat örnektir. Gerçek ürün fiyatı, stok ve varyant bilgileri henüz bağlanmadı.
          </p>
          <div className="detail-divider" />
          <div className="detail-purchase">
            <div className="quantity-picker detail-picker">
              <button
                aria-label="Adedi azalt"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={17} />
              </button>
              <strong>{quantity}</strong>
              <button
                aria-label="Adedi artır"
                disabled={quantity >= 99}
                onClick={() => setQuantity(Math.min(99, quantity + 1))}
              >
                <Plus size={17} />
              </button>
            </div>
            <button
              className="button button-primary detail-add"
              onClick={() => {
                for (let i = 0; i < quantity; i++) addToCart(product.id);
              }}
            >
              <ShoppingBag size={19} /> Sepete ekle
            </button>
            <button
              aria-label={liked ? 'Favorilerden çıkar' : 'Favorilere ekle'}
              className={`detail-heart ${liked ? 'is-favorite' : ''}`}
              onClick={() => toggleFavorite(product.id)}
            >
              <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="detail-benefits">
            <div>
              <ShieldCheck size={19} /> Sade ve kolay alışveriş
            </div>
            <div>
              <MapPin size={19} /> Bağcılar Güneşli mağazası
            </div>
          </div>
        </div>
      </div>
      <div className="detail-tabs">
        <div className="tab-buttons">
          <button
            className={activeTab === 'description' ? 'active' : ''}
            onClick={() => setActiveTab('description')}
          >
            Ürün açıklaması
          </button>
          <button
            className={activeTab === 'details' ? 'active' : ''}
            onClick={() => setActiveTab('details')}
          >
            Ürün bilgileri
          </button>
        </div>
        {activeTab === 'description' ? (
          <p>
            {product.description} Bu bilgiler demo amaçlıdır; gerçek ürün açıklamaları yönetim
            panelinden girilecektir.
          </p>
        ) : (
          <dl>
            <dt>Kategori</dt>
            <dd>{category?.label}</dd>
            <dt>Ürün kodu</dt>
            <dd>{product.id.toUpperCase()}</dd>
            <dt>Görsel</dt>
            <dd>Temsili çizim</dd>
          </dl>
        )}
      </div>
      <section className="related-section">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">BUNLAR DA HOŞUNA GİDEBİLİR</span>
            <h2>
              Benzer ürünler<span className="orange-dot">.</span>
            </h2>
          </div>
          <Link className="text-link" href={`/urunler?category=${product.category}`}>
            Tümünü gör <ArrowRight size={17} />
          </Link>
        </div>
        <div className="products-grid">
          {(related.length ? related : products.filter((p) => p.id !== product.id).slice(0, 4)).map(
            (p) => (
              <ProductCard key={p.id} product={p} />
            ),
          )}
        </div>
      </section>
    </div>
  );
}
