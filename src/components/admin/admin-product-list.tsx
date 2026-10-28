'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Boxes, CirclePlus, Edit3, Package, Search, X } from 'lucide-react';
import { flattenCategories } from '@/lib/category-utils';
import {
  productSearchHref,
  type ProductSearch,
  type ProductSearchMeta,
} from '@/lib/admin-product-search';
import { formatPrice } from '@/lib/format';
import { estimateProductProfit } from '@/lib/admin-product-profit';
import type { Category, Product, StockEntry } from './admin-product-types';
import filterStyles from './admin-list-filters.module.css';
export function AdminProductList({
  products,
  categories,
  movements,
  search,
  result,
  onEdit: startEdit,
  onStock: startStock,
}: {
  products: Product[];
  categories: Category[];
  movements: StockEntry[];
  search: ProductSearch;
  result: ProductSearchMeta | null;
  onEdit: (product: Product) => void;
  onStock: (product: Product) => void;
}) {
  const [tab, setTab] = useState<'products' | 'history'>('products');
  return (
    <div className="admin-content-box">
      <div className="admin-tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          Ürünler ({result?.total ?? '—'})
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Stok hareketleri ({movements.length})
        </button>
      </div>
      {tab === 'products' ? (
        <>
          <form action="/admin/urunler" method="get" key={JSON.stringify(search)}>
            <div className="admin-toolbar">
              <div className="admin-search">
                <Search size={17} />
                <input
                  aria-label="Ürün adı veya stok kodu ara"
                  placeholder="Ürün veya stok kodu ara..."
                  name="q"
                  maxLength={100}
                  defaultValue={search.q}
                />
              </div>
            </div>
            <div className={filterStyles.filters}>
              <label className={filterStyles.field}>
                Kategori
                <select name="category" defaultValue={search.category}>
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
                <select name="visibility" defaultValue={search.visibility}>
                  <option value="all">Tüm ürünler</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>
              </label>
              <label className={filterStyles.field}>
                Stok durumu
                <select name="stock" defaultValue={search.stock}>
                  <option value="all">Tüm stoklar</option>
                  <option value="available">Yeterli stok</option>
                  <option value="low">Düşük stok</option>
                  <option value="out">Stokta yok</option>
                </select>
              </label>
              <label className={filterStyles.field}>
                Sıralama
                <select name="sort" defaultValue={search.sort}>
                  <option value="name">Ürün adı A–Z</option>
                  <option value="priceAsc">Fiyat artan</option>
                  <option value="priceDesc">Fiyat azalan</option>
                  <option value="stockAsc">Stok artan</option>
                  <option value="stockDesc">Stok azalan</option>
                </select>
              </label>
              <button className={filterStyles.reset} type="submit">
                Ara / Filtrele
              </button>
              <Link className={filterStyles.reset} href="/admin/urunler">
                Filtreleri temizle
              </Link>
            </div>
          </form>
          <p className={filterStyles.result}>
            {result ? (
              <>
                {products.length} / {result.total} ürün · Sayfa {result.page} /{' '}
                {Math.max(1, Math.ceil(result.total / result.pageSize))}. Kategori seçimi alt
                kategorileri de kapsar.
              </>
            ) : (
              'Ürün listesi yüklenemedi.'
            )}
          </p>
          <p className={filterStyles.result}>
            Alış maliyeti ve fark yalnızca yöneticilere gösterilir. Brüt fark; KDV, kargo, komisyon ve genel giderleri içermez.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ÜRÜN</th>
                  <th>SATIŞ</th>
                  <th>ALIŞ</th>
                  <th>TAHMİNİ FARK</th>
                  <th>STOK</th>
                  <th>DURUM</th>
                  <th>İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
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
                    <td>{p.has_variants ? <small>Varyant bazlı</small> : p.cost_price === null ? '—' : formatPrice(p.cost_price)}</td>
                    <td>
                      {p.has_variants ? (
                        <small>Varyant bazlı</small>
                      ) : (() => {
                        const estimate=estimateProductProfit(Number(p.price),p.cost_price);
                        return estimate ? (
                          <span title="KDV, kargo, komisyon ve işletme giderleri hariç; tahmini fark">
                            {formatPrice(estimate.difference)}
                            {estimate.marginPercent !== null && (
                              <small> · %{estimate.marginPercent.toLocaleString('tr-TR')}</small>
                            )}
                          </span>
                        ) : '—';
                      })()}
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
            {result && products.length === 0 && (
              <div className="admin-no-results">Bu filtrelere uygun ürün bulunamadı.</div>
            )}
          </div>
          {result && (result.hasPrevious || result.hasNext) && (
            <nav aria-label="Ürün sayfaları" className={filterStyles.filters}>
              {result.hasPrevious && (
                <Link
                  className={filterStyles.reset}
                  href={productSearchHref(search, result.page - 1)}
                >
                  Önceki sayfa
                </Link>
              )}
              {result.hasNext && (
                <Link
                  className={filterStyles.reset}
                  href={productSearchHref(search, result.page + 1)}
                >
                  Sonraki sayfa
                </Link>
              )}
            </nav>
          )}
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
                  <strong>{m.product_name ?? 'Ürün'}</strong>
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
