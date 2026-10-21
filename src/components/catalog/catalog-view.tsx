'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, SlidersHorizontal, Search, X } from 'lucide-react';
import { categories, products } from '@/data/catalog';
import { ProductCard } from '@/components/product/product-card';
import type { CategoryId } from '@/types/shop';
import type { LiveProduct } from '@/lib/real-catalog';
import { LiveProductCard } from '@/components/product/live-product-card';

type Props = { initialCategory: string; initialSearch: string; liveProducts?: LiveProduct[] };
export function CatalogView({ initialCategory, initialSearch, liveProducts = [] }: Props) {
  const [category, setCategory] = useState<CategoryId | 'all'>(
    categories.some((c) => c.id === initialCategory) ? (initialCategory as CategoryId) : 'all',
  );
  const [query, setQuery] = useState(initialSearch);
  const [sort, setSort] = useState('featured');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState('all');
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const result = products.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || `${p.name} ${p.description} ${p.category}`.toLocaleLowerCase('tr-TR').includes(q)) &&
        (maxPrice === 'all' || p.price <= Number(maxPrice)),
    );
    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return result;
  }, [category, query, sort, maxPrice]);
  const currentCat = categories.find((c) => c.id === category);
  return (
    <div className="container-wide catalog-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link>
        <ChevronRight size={14} /> Ürünler{' '}
        {currentCat && (
          <>
            <ChevronRight size={14} />
            {currentCat.label}
          </>
        )}
      </div>
      <div className="catalog-title-row">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE KOLEKSİYONU</span>
          <h1>
            {currentCat?.label ?? (query ? 'Arama sonuçları' : 'Tüm ürünler')}
            <span className="orange-dot">.</span>
          </h1>
          <p>
            Aradığın ürünleri kolayca keşfet. <b>{filtered.length} örnek ürün</b> listeleniyor.
          </p>
        </div>
      </div>
      {liveProducts.length > 0 && (
        <section className="real-catalog-list" style={{ marginBottom: 35 }}>
          <div className="section-heading">
            <div>
              <h2>Mağazamızdaki gerçek ürünler</h2>
              <p>Veritabanından gelen ürünler. Online ödeme henüz açık değil.</p>
            </div>
          </div>
          <div className="products-grid">
            {liveProducts
              .filter(
                (p) =>
                  !query.trim() ||
                  p.name
                    .toLocaleLowerCase('tr-TR')
                    .includes(query.trim().toLocaleLowerCase('tr-TR')),
              )
              .map((p) => (
                <LiveProductCard product={p} key={p.id} />
              ))}
          </div>
        </section>
      )}
      <div className="catalog-toolbar">
        <button className="mobile-filter-button" onClick={() => setMobileFilters(true)}>
          <SlidersHorizontal size={17} /> Filtrele
        </button>
        <span className="results-count">{filtered.length} ürün</span>
        <label>
          Sırala:{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Önerilenler</option>
            <option value="price-asc">Fiyat: Artan</option>
            <option value="price-desc">Fiyat: Azalan</option>
            <option value="name">Ada göre</option>
          </select>
        </label>
      </div>
      <div className="catalog-layout">
        <aside className={`catalog-sidebar ${mobileFilters ? 'show-filter' : ''}`}>
          <div className="filter-head">
            <h2>Filtreler</h2>
            <button
              className="mobile-close"
              aria-label="Filtreleri kapat"
              onClick={() => setMobileFilters(false)}
            >
              <X size={22} />
            </button>
          </div>
          <div className="filter-group">
            <h3>Kategoriler</h3>
            <div className="filter-categories">
              <button
                className={category === 'all' ? 'selected' : ''}
                onClick={() => setCategory('all')}
              >
                Tüm kategoriler
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={category === c.id ? 'selected' : ''}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3>Ürün ara</h3>
            <div className="filter-search">
              <Search size={16} />
              <input
                aria-label="Liste içinde ara"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ürün adı..."
              />
            </div>
          </div>
          <div className="filter-group">
            <h3>Fiyat aralığı</h3>
            <div className="filter-prices">
              <label>
                <input
                  type="radio"
                  checked={maxPrice === 'all'}
                  onChange={() => setMaxPrice('all')}
                />{' '}
                Tüm fiyatlar
              </label>
              <label>
                <input
                  type="radio"
                  checked={maxPrice === '100'}
                  onChange={() => setMaxPrice('100')}
                />{' '}
                100 TL ve altı
              </label>
              <label>
                <input
                  type="radio"
                  checked={maxPrice === '250'}
                  onChange={() => setMaxPrice('250')}
                />{' '}
                250 TL ve altı
              </label>
              <label>
                <input
                  type="radio"
                  checked={maxPrice === '500'}
                  onChange={() => setMaxPrice('500')}
                />{' '}
                500 TL ve altı
              </label>
            </div>
          </div>
          <button
            className="button button-primary mobile-filter-apply"
            onClick={() => setMobileFilters(false)}
          >
            Ürünleri göster <ArrowLeft size={17} />
          </button>
        </aside>
        <div className="catalog-results">
          {filtered.length ? (
            <div className="products-grid">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-result">
              <Search size={38} />
              <h2>Ürün bulamadık</h2>
              <p>Farklı bir arama veya kategori deneyebilirsin.</p>
              <button
                className="button button-outline"
                onClick={() => {
                  setCategory('all');
                  setQuery('');
                  setMaxPrice('all');
                }}
              >
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="demo-disclaimer">
        Bu sayfadaki ürünler, görseller, fiyatlar ve kampanyalar demo amaçlıdır. Gerçek satış ve
        ödeme henüz etkin değildir.
      </p>
    </div>
  );
}
