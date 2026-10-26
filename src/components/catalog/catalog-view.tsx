'use client';

import { useEffect, useMemo, useState, useTransition, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgePercent,
  Check,
  ChevronRight,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LiveProductCard } from '@/components/product/live-product-card';
import { flattenCategories, type StoreCategory } from '@/lib/category-utils';
import {
  DEFAULT_CATALOG_FILTERS,
  serializeCatalogFilters,
  type CatalogFilters,
  type CatalogSort,
} from '@/lib/catalog-filters';
import type { LiveProduct } from '@/lib/real-catalog';
import styles from './catalog-filters.module.css';

type Props = {
  initialFilters: CatalogFilters;
  liveProducts: LiveProduct[];
  categories: StoreCategory[];
  total: number;
  currentPage: number;
  pageCount: number;
  facets: { colors: string[]; sizes: string[] };
};

type Chip = { label: string; key: keyof CatalogFilters };

export function CatalogView({ initialFilters, liveProducts, categories, total, currentPage, pageCount, facets }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [mobileFilters, setMobileFilters] = useState(false);

  // Navigation refreshes the server component; search input remains responsive while typing.
  useEffect(() => {
    if (JSON.stringify(filters) === JSON.stringify(initialFilters)) return;
    const timer = window.setTimeout(() => {
      const encoded = serializeCatalogFilters(filters);
      startTransition(() => router.replace(`/urunler${encoded ? `?${encoded}` : ''}`, { scroll: false }));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [filters, initialFilters, router]);

  useEffect(() => {
    if (!mobileFilters) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFilters(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onEscape);
    };
  }, [mobileFilters]);

  const selectedCategory = categories.find((cat) => cat.slug === filters.category);
  const filtered = liveProducts;
  const activeChips = useMemo<Chip[]>(() => {
    const chips: Chip[] = [];
    if (filters.category !== 'all') chips.push({ key: 'category', label: selectedCategory?.name ?? filters.category });
    if (filters.q.trim()) chips.push({ key: 'q', label: `Arama: ${filters.q.trim()}` });
    if (filters.min) chips.push({ key: 'min', label: `En az ${filters.min} TL` });
    if (filters.max) chips.push({ key: 'max', label: `En çok ${filters.max} TL` });
    if (filters.color) chips.push({ key: 'color', label: `Renk: ${filters.color}` });
    if (filters.size) chips.push({ key: 'size', label: `Ölçü: ${filters.size}` });
    if (filters.stock) chips.push({ key: 'stock', label: 'Stokta olanlar' });
    if (filters.campaign) chips.push({ key: 'campaign', label: 'Kampanyalı ürünler' });
    return chips;
  }, [filters, selectedCategory]);

  function update(patch: Partial<CatalogFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
  }

  function removeChip(key: keyof CatalogFilters) {
    if (key === 'category') update({ category: 'all' });
    else if (key === 'stock') update({ stock: false });
    else if (key === 'campaign') update({ campaign: false });
    else if (key === 'sort') update({ sort: 'featured' });
    else update({ [key]: '' });
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_CATALOG_FILTERS });
  }

  function navigatePage(nextPage: number) {
    const encoded = serializeCatalogFilters(filters);
    const params = new URLSearchParams(encoded);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    startTransition(() => router.push(`/urunler${query ? `?${query}` : ''}`, { scroll: true }));
  }

  const priceInvalid = filters.min !== '' && filters.max !== '' &&
    Number(filters.min) > Number(filters.max);

  return (
    <div className="container-wide catalog-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link href="/urunler">Ürünler</Link>
        {selectedCategory && (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{selectedCategory.name}</span>
          </>
        )}
      </div>

      <div className="catalog-title-row">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE KOLEKSİYONU</span>
          <h1>
            {selectedCategory?.name ?? (filters.q ? 'Arama sonuçları' : 'Tüm ürünler')}
            <span className="orange-dot">.</span>
          </h1>
          <p>İhtiyacın olan ürünleri ara, filtrele ve kolayca keşfet.</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label="Ürün, kategori, renk veya ölçü ara"
            placeholder="Ürün, kategori, renk veya ölçü ara..."
            value={filters.q}
            maxLength={120}
            onChange={(event: ChangeEvent<HTMLInputElement>) => update({ q: event.target.value })}
            autoComplete="off"
          />
          {filters.q && (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => update({ q: '' })}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          className={styles.mobileToggle}
          onClick={() => setMobileFilters(true)}
          aria-controls="catalog-filters"
          aria-expanded={mobileFilters}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtrele
          {activeChips.length > 0 && <span className={styles.count}>{activeChips.length}</span>}
        </button>
        <label className={styles.sortControl}>
          Sırala
          <select
            value={filters.sort}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => update({ sort: event.target.value as CatalogSort })}
          >
            <option value="featured">Öne çıkanlar</option>
            <option value="newest">En yeniler</option>
            <option value="price-asc">Fiyat: Artan</option>
            <option value="price-desc">Fiyat: Azalan</option>
            <option value="name">Ada göre</option>
          </select>
        </label>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span><strong>{total}</strong> ürün bulundu · Sayfa {currentPage}/{pageCount}{isPending ? " · Yükleniyor…" : ""}</span>
        {activeChips.length > 0 && (
          <button type="button" className={styles.resetInline} onClick={clearFilters}>
            <RotateCcw size={13} aria-hidden="true" /> Tümünü temizle
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className={styles.chips} aria-label="Uygulanan filtreler">
          {activeChips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              className={styles.chip}
              onClick={() => removeChip(chip.key)}
              aria-label={`${chip.label} filtresini kaldır`}
            >
              {chip.label}<X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <div className={styles.layout}>
        {mobileFilters && (
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Filtre penceresini kapat"
            onClick={() => setMobileFilters(false)}
          />
        )}
        <aside
          id="catalog-filters"
          className={`${styles.sidebar} ${mobileFilters ? styles.open : ''}`}
          aria-label="Ürün filtreleri"
        >
          <div className={styles.sidebarHead}>
            <h2>Filtreler</h2>
            <button
              type="button"
              className={styles.closeMobile}
              onClick={() => setMobileFilters(false)}
              aria-label="Filtreleri kapat"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <section className={styles.group}>
            <h3>Kategoriler</h3>
            <div className={styles.categories}>
              <button
                type="button"
                className={`${styles.category} ${filters.category === 'all' ? styles.selected : ''}`}
                onClick={() => update({ category: 'all', color: '', size: '' })}
              >
                Tüm kategoriler
                {filters.category === 'all' && <Check size={15} aria-hidden="true" />}
              </button>
              {flattenCategories(categories).map(({ category, depth }) => (
                <button
                  type="button"
                  key={category.id}
                  className={`${styles.category} ${filters.category === category.slug ? styles.selected : ''}`}
                  style={{ paddingLeft: `${14 + depth * 14}px` }}
                  onClick={() => update({ category: category.slug, color: '', size: '' })}
                >
                  <span>{depth > 0 ? '↳ ' : ''}{category.name}</span>
                  {filters.category === category.slug && <Check size={15} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>

          {facets.colors.length > 0 && (
            <section className={styles.group}>
              <label className={styles.groupLabel} htmlFor="catalog-color">Renk</label>
              <select
                id="catalog-color"
                className={styles.select}
                value={filters.color}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => update({ color: event.target.value })}
              >
                <option value="">Tüm renkler</option>
                {facets.colors.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
            </section>
          )}

          {facets.sizes.length > 0 && (
            <section className={styles.group}>
              <label className={styles.groupLabel} htmlFor="catalog-size">Boyut / Ölçü</label>
              <select
                id="catalog-size"
                className={styles.select}
                value={filters.size}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => update({ size: event.target.value })}
              >
                <option value="">Tüm ölçüler</option>
                {facets.sizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </section>
          )}

          <section className={styles.group}>
            <h3>Fiyat aralığı</h3>
            <p className={styles.groupHint}>Ürünlerin güncel kampanyalı fiyatları esas alınır.</p>
            <div className={styles.priceInputs}>
              <label>
                En az (TL)
                <input
                  aria-label="Minimum fiyat (TL)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="10000000"
                  step="0.01"
                  placeholder="0"
                  value={filters.min}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => update({ min: event.target.value })}
                />
              </label>
              <label>
                En çok (TL)
                <input
                  aria-label="Maksimum fiyat (TL)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="10000000"
                  step="0.01"
                  placeholder="Örn. 500"
                  value={filters.max}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => update({ max: event.target.value })}
                />
              </label>
            </div>
            {priceInvalid && <p className={styles.validation} role="alert">Minimum fiyat, maksimum fiyattan büyük olamaz.</p>}
          </section>

          <section className={styles.group}>
            <h3>Diğer seçenekler</h3>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.stock}
                onChange={(event: ChangeEvent<HTMLInputElement>) => update({ stock: event.target.checked })}
              />
              Sadece stokta olanlar
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.campaign}
                onChange={(event: ChangeEvent<HTMLInputElement>) => update({ campaign: event.target.checked })}
              />
              <BadgePercent size={17} aria-hidden="true" /> Kampanyalı ürünler
            </label>
            <p className={styles.groupHint}>Anında indirim ve koşullu sepet kampanyaları dahildir.</p>
          </section>

          <button type="button" className={styles.resetButton} onClick={clearFilters}>
            <RotateCcw size={15} aria-hidden="true" /> Filtreleri temizle
          </button>
          <button
            type="button"
            className={styles.applyMobile}
            onClick={() => setMobileFilters(false)}
          >
            {total} ürünü göster
          </button>
        </aside>

        <div className={styles.results}>
          {filtered.length > 0 ? (
            <div className="products-grid">
              {filtered.map((product) => <LiveProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className={styles.empty}>
              <Search size={39} color="#a1a8b1" aria-hidden="true" />
              <h2>Aradığın özelliklerde ürün bulunamadı</h2>
              <p>Fiyat aralığını genişletmeyi veya filtrelerden bazılarını kaldırmayı deneyebilirsin.</p>
              <button type="button" onClick={clearFilters}>
                <RotateCcw size={16} aria-hidden="true" /> Filtreleri temizle
              </button>
            </div>
          )}
        </div>
      </div>
      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Ürün sayfaları">
          <button type="button" disabled={currentPage <= 1 || isPending} onClick={() => navigatePage(currentPage - 1)}>Önceki</button>
          <span>Sayfa {currentPage} / {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount || isPending} onClick={() => navigatePage(currentPage + 1)}>Sonraki</button>
        </nav>
      )}
      <p className="demo-disclaimer">
        Ürün ve stok bilgileri mağaza veritabanından gelir. Kampanyalı fiyatlar bilgilendirme amaçlıdır;
        sipariş sırasında indirim ve stok yeniden doğrulanır. Online ödeme henüz aktif değildir.
      </p>
    </div>
  );
}
