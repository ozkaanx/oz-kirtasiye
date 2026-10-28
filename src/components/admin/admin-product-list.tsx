'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Boxes, CirclePlus, Edit3, Package, Search, X } from 'lucide-react';
import { descendantIds, flattenCategories } from '@/lib/category-utils';
import { formatPrice } from '@/lib/format';
import type { Category, Product, StockEntry } from './admin-product-types';
import filterStyles from './admin-list-filters.module.css';
export function AdminProductList({
  products,
  categories,
  movements,
  onEdit: startEdit,
  onStock: startStock,
}: {
  products: Product[];
  categories: Category[];
  movements: StockEntry[];
  onEdit: (product: Product) => void;
  onStock: (product: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'priceAsc' | 'priceDesc' | 'stockAsc' | 'stockDesc'
  >('name');
  const [tab, setTab] = useState<'products' | 'history'>('products');
  const visibleCategories = useMemo(
    () => (categoryFilter === 'all' ? null : descendantIds(categories, categoryFilter)),
    [categories, categoryFilter],
  );
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('tr-TR');
    const rows = products.filter((p) => {
      if (text && !`${p.name} ${p.sku ?? ''} ${p.slug}`.toLocaleLowerCase('tr-TR').includes(text))
        return false;
      if (visibleCategories && (!p.category_id || !visibleCategories.has(p.category_id)))
        return false;
      if (visibilityFilter === 'active' && !p.is_active) return false;
      if (visibilityFilter === 'inactive' && p.is_active) return false;
      if (stockFilter === 'out' && p.stock_quantity !== 0) return false;
      if (
        stockFilter === 'low' &&
        !(p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold)
      )
        return false;
      if (stockFilter === 'available' && p.stock_quantity <= p.low_stock_threshold) return false;
      return true;
    });
    return rows.sort((a, b) => {
      switch (sortBy) {
        case 'priceAsc':
          return Number(a.price) - Number(b.price);
        case 'priceDesc':
          return Number(b.price) - Number(a.price);
        case 'stockAsc':
          return a.stock_quantity - b.stock_quantity;
        case 'stockDesc':
          return b.stock_quantity - a.stock_quantity;
        default:
          return a.name.localeCompare(b.name, 'tr');
      }
    });
  }, [products, query, visibleCategories, visibilityFilter, stockFilter, sortBy]);

  function clearProductFilters() {
    setQuery('');
    setCategoryFilter('all');
    setVisibilityFilter('all');
    setStockFilter('all');
    setSortBy('name');
  }
  return (
    <div className="admin-content-box">
      <div className="admin-tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          Ürünler ({products.length})
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Stok hareketleri ({movements.length})
        </button>
      </div>
      {tab === 'products' ? (
        <>
          <div className="admin-toolbar">
            <div className="admin-search">
              <Search size={17} />
              <input
                aria-label="Ürün adı veya stok kodu ara"
                placeholder="Ürün veya stok kodu ara..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className={filterStyles.filters}>
            <label className={filterStyles.field}>
              Kategori
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Tüm kategoriler</option>
                {flattenCategories(categories).map(({ category, depth }) => (
                  <option key={category.id} value={category.id}>
                    {'— '.repeat(depth)}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterStyles.field}>
              Yayın durumu
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as typeof visibilityFilter)}
              >
                <option value="all">Tüm ürünler</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </label>
            <label className={filterStyles.field}>
              Stok durumu
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
              >
                <option value="all">Tüm stoklar</option>
                <option value="available">Yeterli stok</option>
                <option value="low">Düşük stok</option>
                <option value="out">Stokta yok</option>
              </select>
            </label>
            <label className={filterStyles.field}>
              Sıralama
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="name">Ürün adı A–Z</option>
                <option value="priceAsc">Fiyat artan</option>
                <option value="priceDesc">Fiyat azalan</option>
                <option value="stockAsc">Stok artan</option>
                <option value="stockDesc">Stok azalan</option>
              </select>
            </label>
            <button className={filterStyles.reset} type="button" onClick={clearProductFilters}>
              Filtreleri temizle
            </button>
          </div>
          <p className={filterStyles.result}>
            {filtered.length} / {products.length} ürün gösteriliyor. Kategori seçimi alt
            kategorileri de kapsar. Liste en fazla 1000 kayıt yükler.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ÜRÜN</th>
                  <th>FİYAT</th>
                  <th>STOK</th>
                  <th>DURUM</th>
                  <th>İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-product">
                        <span style={{ background: '#f2f3f6' }}>
                          {p.imageUrl ? <img alt="" src={p.imageUrl} /> : <Package size={25} />}
                        </span>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>
                      {p.has_variants && <small>Başlangıç </small>}
                      {formatPrice(Number(p.price))}
                    </td>
                    <td>
                      {p.stock_quantity} adet {p.has_variants && <small>(varyant)</small>}
                    </td>
                    <td>
                      <span
                        className={`admin-status ${p.stock_quantity === 0 ? 'out' : p.stock_quantity <= p.low_stock_threshold ? 'low' : 'in'}`}
                      >
                        {!p.is_active
                          ? 'Pasif'
                          : p.stock_quantity === 0
                            ? 'Tükendi'
                            : p.stock_quantity <= p.low_stock_threshold
                              ? 'Stok az'
                              : 'Aktif'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-action-group">
                        <button className="admin-edit" onClick={() => startEdit(p)}>
                          <Edit3 size={14} /> Düzenle
                        </button>
                        {p.has_variants ? (
                          <Link className="admin-edit" href={`/admin/urunler/${p.id}/varyantlar`}>
                            <Boxes size={14} /> Varyant stok
                          </Link>
                        ) : (
                          <button className="admin-edit" onClick={() => startStock(p)}>
                            <Boxes size={14} /> Stok
                          </button>
                        )}
                        <Link className="admin-edit" href={`/admin/urunler/${p.id}/varyantlar`}>
                          Varyantlar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="admin-no-results">Bu filtrelere uygun ürün bulunamadı.</div>
            )}
          </div>
        </>
      ) : (
        <div className="admin-history">
          {movements.length === 0 ? (
            <div className="admin-no-results">Henüz stok hareketi yok.</div>
          ) : (
            movements.map((m) => (
              <div key={m.id}>
                <span className={`history-sign ${m.change_quantity > 0 ? 'positive' : 'negative'}`}>
                  {m.change_quantity > 0 ? <CirclePlus size={17} /> : <X size={17} />}
                </span>
                <div>
                  <strong>{products.find((p) => p.id === m.product_id)?.name ?? 'Ürün'}</strong>
                  <small>
                    {m.note || m.reason} · {new Date(m.created_at).toLocaleString('tr-TR')}
                  </small>
                </div>
                <b className={m.change_quantity > 0 ? 'plus-text' : 'minus-text'}>
                  {m.change_quantity > 0 ? '+' : ''}
                  {m.change_quantity}
                </b>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
