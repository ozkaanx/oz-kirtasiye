'use client';

import type { ProductSearch, ProductSearchMeta } from '@/lib/admin-product-search';
import { useState } from 'react';
import Link from 'next/link';
import { Activity, Boxes, ClipboardList, FolderTree, Package, Plus } from 'lucide-react';
import type { Category, Product, StockEntry } from './admin-product-types';
import { AdminProductList } from './admin-product-list';
import { AdminProductEditor } from './admin-product-editor';
import { AdminProductStockDialog } from './admin-product-stock-dialog';

export function AdminProducts({
  products,
  categories,
  movements,
  loadError,
  search,
  result,
}: {
  products: Product[];
  categories: Category[];
  movements: StockEntry[];
  loadError: string | null;
  search: ProductSearch;
  result: ProductSearchMeta | null;
}) {
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');

  function startCreate() {
    setNotice('');
    setEditing('new');
  }
  function startEdit(product: Product) {
    setNotice('');
    setEditing(product);
  }
  function startStock(product: Product) {
    if (!product.has_variants) {
      setNotice('');
      setSelected(product);
    }
  }

  return (
    <>
      <div className="admin-body">
        <div className="admin-page-heading">
          <div>
            <span className="section-eyebrow">ÖZ KIRTASİYE · GERÇEK VERİLER</span>
            <h1>
              Ürün ve stok yönetimi<span className="orange-dot">.</span>
            </h1>
            <p>Manuel stok ve ürün düzenleme işlemleri Supabase&apos;e kaydedilir.</p>
          </div>
          <button type="button" className="button button-primary" onClick={startCreate}>
            <Plus size={17} /> Yeni ürün ekle
          </button>
        </div>
        {loadError && (
          <p role="alert" className="admin-form-error">
            Veri okuma hatası: {loadError}
          </p>
        )}
        {notice && (
          <p role="status" className="admin-form-success">
            {notice}
          </p>
        )}
        <p className="admin-category-help">Tüm katalog özeti</p>
        <div className="admin-stats">
          <div>
            <Package size={22} />
            <span>Ürün sayısı</span>
            <strong>{result?.stats.total ?? '—'}</strong>
          </div>
          <div>
            <Boxes size={22} />
            <span>Toplam stok</span>
            <strong>{result?.stats.stock ?? '—'}</strong>
          </div>
          <div>
            <Activity size={22} />
            <span>Stok az</span>
            <strong>{result?.stats.low ?? '—'}</strong>
          </div>
          <div>
            <ClipboardList size={22} />
            <span>Stokta yok</span>
            <strong>{result?.stats.out ?? '—'}</strong>
          </div>
        </div>
        <AdminProductList
          products={products}
          result={result}
          search={search}
          categories={categories}
          movements={movements}
          onEdit={startEdit}
          onStock={startStock}
        />
        <div className="admin-category-shortcut">
          <span>
            <FolderTree size={20} /> Kategoriler ve alt kategoriler
          </span>
          <Link href="/admin/kategoriler" className="button button-outline">
            Kategorileri yönet →
          </Link>
        </div>
      </div>

      {editing && (
        <AdminProductEditor
          key={editing === 'new' ? 'new' : editing.id}
          editing={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      )}
      {selected && (
        <AdminProductStockDialog
          key={selected.id}
          selected={selected}
          onClose={() => setSelected(null)}
          onSaved={(message) => {
            setSelected(null);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}
