'use client';

import { type FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Boxes,
  Check,
  CirclePlus,
  ClipboardList,
  Edit3,
  FolderTree,
  LogOut,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { formatPrice } from '@/lib/format';
import filterStyles from './admin-list-filters.module.css';
import {
  descendantIds,
  flattenCategories,
  slugifyTurkish,
  type StoreCategory,
} from '@/lib/category-utils';

type Category = StoreCategory;
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  has_variants: boolean;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  product_images: { storage_path: string; sort_order: number }[];
  imageUrl: string | null;
};
type StockEntry = {
  id: string;
  product_id: string;
  change_quantity: number;
  quantity_after: number;
  created_at: string;
  note: string | null;
  reason: string;
};
type ProductForm = {
  name: string;
  slug: string;
  description: string;
  category_id: string;
  sku: string;
  price: string;
  compare_at_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  is_active: boolean;
  is_featured: boolean;
};
const emptyForm: ProductForm = {
  name: '',
  slug: '',
  description: '',
  category_id: '',
  sku: '',
  price: '',
  compare_at_price: '',
  stock_quantity: '0',
  low_stock_threshold: '5',
  is_active: false,
  is_featured: false,
};

function errorText(err: unknown) {
  return err instanceof Error ? err.message : 'İşlem başarısız oldu.';
}

export function AdminProducts({
  products,
  categories,
  movements,
  loadError,
}: {
  products: Product[];
  categories: Category[];
  movements: StockEntry[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'priceAsc' | 'priceDesc' | 'stockAsc' | 'stockDesc'
  >('name');
  const [tab, setTab] = useState<'products' | 'history'>('products');
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState('1');
  const [stockDirection, setStockDirection] = useState<'add' | 'remove'>('add');
  const [stockNote, setStockNote] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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
  const low = products.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold,
  ).length;
  const zero = products.filter((p) => p.stock_quantity === 0).length;
  const total = products.reduce((sum, p) => sum + p.stock_quantity, 0);

  function startCreate() {
    setEditing('new');
    setForm(emptyForm);
    setPhoto(null);
    setError('');
    setNotice('');
  }
  function startEdit(p: Product) {
    setEditing(p);
    setPhoto(null);
    setError('');
    setNotice('');
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      category_id: p.category_id ?? '',
      sku: p.sku ?? '',
      price: String(p.price),
      compare_at_price: p.compare_at_price == null ? '' : String(p.compare_at_price),
      stock_quantity: String(p.stock_quantity),
      low_stock_threshold: String(p.low_stock_threshold),
      is_active: p.is_active,
      is_featured: p.is_featured,
    });
  }
  function startStock(p: Product) {
    if (p.has_variants) return;
    setSelected(p);
    setStockDelta('1');
    setStockDirection('add');
    setStockNote('');
    setError('');
    setNotice('');
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const price = Number(form.price),
      compare = form.compare_at_price.trim() ? Number(form.compare_at_price) : null;
    const stock = Number(form.stock_quantity),
      threshold = Number(form.low_stock_threshold);
    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      (compare !== null && (!Number.isFinite(compare) || compare < 0)) ||
      !Number.isInteger(threshold) ||
      threshold < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setError('Geçerli ürün adı, fiyat ve stok değerleri girin.');
      return;
    }
    if (
      photo &&
      (photo.size > 5 * 1024 * 1024 ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(photo.type))
    ) {
      setError('Görsel PNG, JPG veya WebP ve en fazla 5 MB olmalı.');
      return;
    }
    const current = editing;
    if (!current) return;
    setPending(true);
    setError('');
    setNotice('');
    const supabase = createBrowserSupabase();
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugifyTurkish(form.slug),
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        sku: form.sku.trim() || null,
        price,
        compare_at_price: compare,
        low_stock_threshold: threshold,
        is_active: form.is_active,
        is_featured: form.is_featured,
      };
      let productId: string;
      if (current === 'new') {
        const { data, error } = await supabase
          .from('products')
          .insert({ ...payload, stock_quantity: stock })
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      } else {
        const { data, error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', current.id)
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      }
      if (photo) {
        const extension =
          photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${productId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError)
          throw new Error('Ürün kaydedildi ancak fotoğraf yüklenemedi: ' + uploadError.message);
        const { error: imageError } = await supabase.from('product_images').insert({
          product_id: productId,
          storage_path: path,
          sort_order: 0,
          alt_text: form.name.trim(),
        });
        if (imageError)
          throw new Error(
            'Ürün kaydedildi ancak görsel kaydı oluşturulamadı: ' + imageError.message,
          );
      }
      setEditing(null);
      setNotice("Ürün Supabase'e kaydedildi.");
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    const amount = Number(stockDelta);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      setError('Miktar 1–100000 aralığında tam sayı olmalı.');
      return;
    }
    setPending(true);
    setError('');
    setNotice('');
    try {
      const { error } = await createBrowserSupabase().rpc('adjust_product_stock', {
        p_product_id: selected.id,
        p_change: stockDirection === 'add' ? amount : -amount,
        p_note: stockNote.trim() || null,
      });
      if (error) throw error;
      setSelected(null);
      setNotice('Stok değişikliği veritabanına kaydedildi.');
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await createBrowserSupabase().auth.signOut();
    router.replace('/admin/giris');
    router.refresh();
  }
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <div className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button className="admin-logout" onClick={logout}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
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
          {!editing && !selected && error && (
            <p role="alert" className="admin-form-error">
              {error}
            </p>
          )}
          <div className="admin-stats">
            <div>
              <Package size={22} />
              <span>Ürün sayısı</span>
              <strong>{products.length}</strong>
            </div>
            <div>
              <Boxes size={22} />
              <span>Toplam stok</span>
              <strong>{total}</strong>
            </div>
            <div>
              <Activity size={22} />
              <span>Stok az</span>
              <strong>{low}</strong>
            </div>
            <div>
              <ClipboardList size={22} />
              <span>Stokta yok</span>
              <strong>{zero}</strong>
            </div>
          </div>
          <div className="admin-content-box">
            <div className="admin-tabs">
              <button
                className={tab === 'products' ? 'active' : ''}
                onClick={() => setTab('products')}
              >
                Ürünler ({products.length})
              </button>
              <button
                className={tab === 'history' ? 'active' : ''}
                onClick={() => setTab('history')}
              >
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
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
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
                      onChange={(e) =>
                        setVisibilityFilter(e.target.value as typeof visibilityFilter)
                      }
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
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    >
                      <option value="name">Ürün adı A–Z</option>
                      <option value="priceAsc">Fiyat artan</option>
                      <option value="priceDesc">Fiyat azalan</option>
                      <option value="stockAsc">Stok artan</option>
                      <option value="stockDesc">Stok azalan</option>
                    </select>
                  </label>
                  <button
                    className={filterStyles.reset}
                    type="button"
                    onClick={clearProductFilters}
                  >
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
                                {p.imageUrl ? (
                                  <img alt="" src={p.imageUrl} />
                                ) : (
                                  <Package size={25} />
                                )}
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
                                <Link
                                  className="admin-edit"
                                  href={`/admin/urunler/${p.id}/varyantlar`}
                                >
                                  <Boxes size={14} /> Varyant stok
                                </Link>
                              ) : (
                                <button className="admin-edit" onClick={() => startStock(p)}>
                                  <Boxes size={14} /> Stok
                                </button>
                              )}
                              <Link
                                className="admin-edit"
                                href={`/admin/urunler/${p.id}/varyantlar`}
                              >
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
                      <span
                        className={`history-sign ${m.change_quantity > 0 ? 'positive' : 'negative'}`}
                      >
                        {m.change_quantity > 0 ? <CirclePlus size={17} /> : <X size={17} />}
                      </span>
                      <div>
                        <strong>
                          {products.find((p) => p.id === m.product_id)?.name ?? 'Ürün'}
                        </strong>
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
          <div className="admin-category-shortcut">
            <span>
              <FolderTree size={20} /> Kategoriler ve alt kategoriler
            </span>
            <Link href="/admin/kategoriler" className="button button-outline">
              Kategorileri yönet →
            </Link>
          </div>
        </div>
      </div>
      {editing && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div
            className="admin-modal admin-modal-large"
            role="dialog"
            aria-modal="true"
            aria-label="Ürün formu"
          >
            <div className="admin-modal-heading">
              <h2>{editing === 'new' ? 'Yeni ürün ekle' : 'Ürün düzenle'}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Kapat">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveProduct} className="admin-product-form">
              <label className="admin-field">
                Ürün adı *
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      name: e.target.value,
                      slug: editing === 'new' ? slugifyTurkish(e.target.value) : s.slug,
                    }))
                  }
                />
              </label>
              <label className="admin-field">
                URL (slug) *
                <input
                  required
                  value={form.slug}
                  onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                Kategori
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((s) => ({ ...s, category_id: e.target.value }))}
                >
                  <option value="">Kategori seçilmedi</option>
                  {flattenCategories(categories).map(({ category: c, depth }) => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={!c.is_active && form.category_id !== c.id}
                    >
                      {'— '.repeat(depth)}
                      {c.name}
                      {!c.is_active ? ' (Pasif)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                Ürün kodu (isteğe bağlı)
                <input
                  value={form.sku}
                  onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                Satış fiyatı (₺) *
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                Eski fiyat (isteğe bağlı)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.compare_at_price}
                  onChange={(e) => setForm((s) => ({ ...s, compare_at_price: e.target.value }))}
                />
              </label>
              {editing === 'new' && (
                <label className="admin-field">
                  İlk stok miktarı
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.stock_quantity}
                    onChange={(e) => setForm((s) => ({ ...s, stock_quantity: e.target.value }))}
                  />
                </label>
              )}
              <label className="admin-field">
                Az stok uyarısı
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm((s) => ({ ...s, low_stock_threshold: e.target.value }))}
                />
              </label>
              <label className="admin-field admin-form-wide">
                Ürün açıklaması
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                />
              </label>
              <label className="admin-field admin-form-wide">
                Ürün fotoğrafı (PNG/JPG/WebP, 5 MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
                />{' '}
                Sitede yayınla
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm((s) => ({ ...s, is_featured: e.target.checked }))}
                />{' '}
                Öne çıkan ürün
              </label>
              {error && (
                <p role="alert" className="admin-form-error admin-form-wide">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="button button-primary admin-form-wide"
              >
                <Check size={18} />
                {pending ? 'Kaydediliyor...' : 'Ürünü kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
      {selected && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Stok güncelle">
            <div className="admin-modal-heading">
              <h2>Stok güncelle</h2>
              <button type="button" onClick={() => setSelected(null)} aria-label="Kapat">
                <X size={20} />
              </button>
            </div>
            <p className="admin-stock-selected">
              {selected.name} · <strong>{selected.stock_quantity} adet</strong>
            </p>
            <form onSubmit={saveStock}>
              <div className="stock-switch">
                <button
                  type="button"
                  className={stockDirection === 'add' ? 'active' : ''}
                  onClick={() => setStockDirection('add')}
                >
                  <Plus size={17} /> Stok artır
                </button>
                <button
                  type="button"
                  className={stockDirection === 'remove' ? 'active' : ''}
                  onClick={() => setStockDirection('remove')}
                >
                  <X size={17} /> Stok azalt
                </button>
              </div>
              <label className="admin-field">
                Miktar
                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                />
              </label>
              <label className="admin-field">
                Açıklama
                <input
                  maxLength={250}
                  placeholder="Örn. Mağaza satışı"
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                />
              </label>
              <p className="admin-prediction">
                İşlem sonrası stok{' '}
                <strong>
                  {selected.stock_quantity +
                    (stockDirection === 'add' ? 1 : -1) * (Number(stockDelta) || 0)}{' '}
                  adet
                </strong>
              </p>
              {error && (
                <p role="alert" className="admin-form-error">
                  {error}
                </p>
              )}
              <button className="button button-primary admin-full-button" disabled={pending}>
                {pending ? 'Kaydediliyor...' : 'Stok değişikliğini kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
