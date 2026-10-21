'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { LiveProductCard } from '@/components/product/live-product-card';
import { descendantIds, flattenCategories, type StoreCategory } from '@/lib/category-utils';
import type { LiveProduct } from '@/lib/real-catalog';

type Props = {
  initialCategory: string;
  initialSearch: string;
  liveProducts: LiveProduct[];
  categories: StoreCategory[];
};

type SortType = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name';

export function CatalogView({ initialCategory, initialSearch, liveProducts, categories }: Props) {
  const router = useRouter();
  const [categorySlug, setCategorySlug] = useState(initialCategory);
  const [query, setQuery] = useState(initialSearch);
  const [sort, setSort] = useState<SortType>('featured');
  const [maxPrice, setMaxPrice] = useState('all');
  const [inStock, setInStock] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);

  const selectedCategory = categories.find((cat) => cat.slug === categorySlug);
  const visibleCategoryIds = useMemo(
    () => (selectedCategory ? descendantIds(categories, selectedCategory.id) : null),
    [categories, selectedCategory],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    const result = liveProducts.filter((product) => {
      if (
        visibleCategoryIds &&
        (!product.category_id || !visibleCategoryIds.has(product.category_id))
      ) {
        return false;
      }
      if (
        normalized &&
        !`${product.name} ${product.description ?? ''}`
          .toLocaleLowerCase('tr-TR')
          .includes(normalized)
      ) {
        return false;
      }
      if (maxPrice !== 'all' && product.price > Number(maxPrice)) return false;
      if (inStock && product.stock_quantity === 0) return false;
      return true;
    });
    switch (sort) {
      case 'price-asc':
        return result.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return result.sort((a, b) => b.price - a.price);
      case 'name':
        return result.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      case 'newest':
        return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
      default:
        return result.sort(
          (a, b) =>
            Number(b.is_featured) - Number(a.is_featured) ||
            b.created_at.localeCompare(a.created_at),
        );
    }
  }, [liveProducts, visibleCategoryIds, query, maxPrice, inStock, sort]);

  function navigateCategory(slug: string) {
    setCategorySlug(slug);
    const params = new URLSearchParams();
    if (slug !== 'all') params.set('category', slug);
    if (query.trim()) params.set('q', query.trim());
    router.replace(`/urunler${params.toString() ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
    setMobileFilters(false);
  }

  function resetFilters() {
    setQuery('');
    setMaxPrice('all');
    setInStock(false);
    setSort('featured');
    setCategorySlug('all');
    router.replace('/urunler', { scroll: false });
  }

  return (
    <div className="container-wide catalog-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link>
        <ChevronRight size={14} />
        <Link href="/urunler">Ürünler</Link>
        {selectedCategory && (
          <>
            <ChevronRight size={14} />
            {selectedCategory.name}
          </>
        )}
      </div>
      <div className="catalog-title-row">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE KOLEKSİYONU</span>
          <h1>
            {selectedCategory?.name ?? (query ? 'Arama sonuçları' : 'Tüm ürünler')}
            <span className="orange-dot">.</span>
          </h1>
          <p>
            Mağazamızın güncel ürünleri. <b>{filtered.length} ürün</b> listeleniyor.
          </p>
        </div>
      </div>

      <div className="catalog-toolbar">
        <button
          type="button"
          className="mobile-filter-button"
          onClick={() => setMobileFilters(true)}
        >
          <SlidersHorizontal size={17} /> Filtrele
        </button>
        <span className="results-count">{filtered.length} ürün</span>
        <label>
          Sırala:{' '}
          <select value={sort} onChange={(event) => setSort(event.target.value as SortType)}>
            <option value="featured">Öne çıkanlar</option>
            <option value="newest">En yeniler</option>
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
              type="button"
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
                type="button"
                className={!selectedCategory ? 'selected' : ''}
                onClick={() => navigateCategory('all')}
              >
                Tüm kategoriler
              </button>
              {flattenCategories(categories).map(({ category, depth }) => (
                <button
                  type="button"
                  key={category.id}
                  className={selectedCategory?.id === category.id ? 'selected' : ''}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                  onClick={() => navigateCategory(category.slug)}
                >
                  {depth > 0 ? '↳ ' : ''}
                  {category.name}
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ürün adı..."
              />
            </div>
          </div>
          <div className="filter-group">
            <h3>Fiyat aralığı</h3>
            <div className="filter-prices">
              {[
                ['all', 'Tüm fiyatlar'],
                ['100', '100 TL ve altı'],
                ['250', '250 TL ve altı'],
                ['500', '500 TL ve altı'],
                ['1000', '1.000 TL ve altı'],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="max-price"
                    checked={maxPrice === value}
                    onChange={() => setMaxPrice(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label className="catalog-stock-toggle">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(event) => setInStock(event.target.checked)}
              />
              Sadece stokta olanlar
            </label>
          </div>
          <button
            type="button"
            className="button button-outline catalog-reset"
            onClick={resetFilters}
          >
            Filtreleri temizle
          </button>
          <button
            type="button"
            className="button button-primary mobile-filter-apply"
            onClick={() => setMobileFilters(false)}
          >
            Ürünleri göster <ArrowLeft size={17} />
          </button>
        </aside>
        <div className="catalog-results">
          {filtered.length ? (
            <div className="products-grid">
              {filtered.map((product) => (
                <LiveProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-result">
              <Search size={38} />
              <h2>Henüz ürün bulamadık</h2>
              <p>
                {liveProducts.length === 0
                  ? 'Mağaza ürünleri eklendikçe burada görünecek.'
                  : 'Farklı bir arama veya kategori deneyebilirsin.'}
              </p>
              <button type="button" className="button button-outline" onClick={resetFilters}>
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="demo-disclaimer">
        Fiyat ve stok bilgileri mağaza veritabanından gelir. Online sipariş ve ödeme henüz etkin
        değildir.
      </p>
    </div>
  );
}
