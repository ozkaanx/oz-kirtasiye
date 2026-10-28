'use client';
import Image from 'next/image';

import { type FormEvent, useState } from 'react';

import { useRouter } from 'next/navigation';
import { Check, ImagePlus, Package, Plus, Save, Trash2, X } from 'lucide-react';
import {
  validateCatalogNumbers,
  validateCatalogImage,
  validateStockAdjustment,
} from '@/lib/admin-catalog-validation';
import { createBrowserSupabase } from '@/lib/supabase/browser';

import { formatPrice } from '@/lib/format';
import styles from './admin-variants.module.css';

type Variant = {
  id: string;
  product_id: string;
  sku: string | null;
  color: string;
  size: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  image_path: string | null;
  imageUrl: string | null;
  is_active: boolean;
  sort_order: number;
};
type Product = {
  id: string;
  name: string;
  has_variants: boolean;
  stock_quantity: number;
  price: number;
};
type StockMove = {
  id: string;
  variant_id: string;
  quantity_before: number;
  change_quantity: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
};
type Form = {
  color: string;
  size: string;
  sku: string;
  price: string;
  compare: string;
  stock: string;
  threshold: string;
  isActive: boolean;
};
const blank: Form = {
  color: '',
  size: '',
  sku: '',
  price: '',
  compare: '',
  stock: '0',
  threshold: '5',
  isActive: true,
};
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'İşlem başarısız oldu.';
}

export function AdminVariants({
  product,
  variants,
  movements,
  loadError,
}: {
  product: Product;
  variants: Variant[];
  movements: StockMove[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Variant | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Variant | null>(null);
  const [change, setChange] = useState('1');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const active = variants.filter((v) => v.is_active);
  const totalStock = active.reduce((sum, v) => sum + v.stock_quantity, 0);
  const lowStock = active.filter((v) => v.stock_quantity <= v.low_stock_threshold).length;
  function openCreate() {
    setEditing('new');
    setForm(blank);
    setFile(null);
    setError('');
    setSuccess('');
  }
  function openEdit(v: Variant) {
    setEditing(v);
    setFile(null);
    setError('');
    setSuccess('');
    setForm({
      color: v.color,
      size: v.size,
      sku: v.sku ?? '',
      price: String(v.price),
      compare: v.compare_at_price == null ? '' : String(v.compare_at_price),
      stock: String(v.stock_quantity),
      threshold: String(v.low_stock_threshold),
      isActive: v.is_active,
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || pending) return;
    if (
      !(form.color.trim() || form.size.trim()) ||
      form.color.length > 60 ||
      form.size.length > 60
    ) {
      setError('Renk veya boyut gerekli; en fazla 60 karakter olabilir.');
      return;
    }
    const validated = validateCatalogNumbers(
      {
        price: form.price,
        compare: form.compare,
        stock: editing === 'new' ? form.stock : '0',
        threshold: form.threshold,
      },
      'variant',
    );
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    const { price, compare, stock, threshold } = validated.value;
    const imageError = validateCatalogImage(file);
    if (imageError) {
      setError(imageError);
      return;
    }
    const supabase = createBrowserSupabase();
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        product_id: product.id,
        color: form.color.trim(),
        size: form.size.trim(),
        sku: form.sku.trim() || null,
        price,
        compare_at_price: compare,
        low_stock_threshold: threshold,
        is_active: form.isActive,
      };
      let id: string;
      if (editing === 'new') {
        const { data, error: insertError } = await supabase
          .from('product_variants')
          .insert({ ...payload, stock_quantity: stock, sort_order: variants.length })
          .select('id')
          .single();
        if (insertError) throw insertError;
        id = data.id;
      } else {
        const { data, error: updateError } = await supabase
          .from('product_variants')
          .update(payload)
          .eq('id', editing.id)
          .select('id')
          .single();
        if (updateError) throw updateError;
        id = data.id;
      }
      if (file) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${product.id}/variants/${id}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError)
          throw new Error('Varyant kaydedildi ancak fotoğraf yüklenemedi: ' + uploadError.message);
        const { error: imageError } = await supabase
          .from('product_variants')
          .update({ image_path: path })
          .eq('id', id);
        if (imageError)
          throw new Error('Fotoğraf yüklendi ancak varyanta bağlanamadı: ' + imageError.message);
      }
      setEditing(null);
      setSuccess('Varyant kaydedildi.');
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  function openStock(v: Variant) {
    setSelected(v);
    setChange('1');
    setDirection('increase');
    setNote('');
    setError('');
  }
  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    const validated = validateStockAdjustment(change, selected.stock_quantity, direction);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setPending(true);
    setError('');
    try {
      const { error: stockError } = await createBrowserSupabase().rpc('adjust_variant_stock', {
        p_variant_id: selected.id,
        p_change: validated.value.change,
        p_note: note.trim() || null,
      });
      if (stockError) throw stockError;
      setSelected(null);
      setSuccess('Varyant stoğu güncellendi.');
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  }
  async function disable(v: Variant) {
    if (pending || !confirm(`${v.color} ${v.size} seçeneği satıştan kaldırılsın mı?`)) return;
    setPending(true);
    setError('');
    try {
      const { error: e } = await createBrowserSupabase()
        .from('product_variants')
        .update({ is_active: false })
        .eq('id', v.id);
      if (e) throw e;
      setSuccess('Varyant yayından kaldırıldı.');
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="admin-body">
        <header className="admin-page-heading">
          <div>
            <span className="section-eyebrow">ÖZ KIRTASİYE · ÜRÜN SEÇENEKLERİ</span>
            <h1>
              Varyant yönetimi<span className="orange-dot">.</span>
            </h1>
            <p>{product.name} · Her renk/ölçü için ayrı fiyat ve stok.</p>
          </div>
          <button type="button" className="button button-primary" onClick={openCreate}>
            <Plus size={17} /> Varyant ekle
          </button>
        </header>
        {loadError && (
          <p className="admin-form-error" role="alert">
            {loadError}
          </p>
        )}
        {success && (
          <p className="admin-form-success" role="status">
            {success}
          </p>
        )}
        {!editing && !selected && error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        {!product.has_variants && (
          <p className={styles.hint}>
            İlk varyantı eklediğinde bu ürün otomatik olarak varyantlı ürüne dönüşür. Mevcut tekli
            ürün stoğu korunur ancak müşteriye gösterilmez. Renk/ölçü stoklarını ayrıca gir.
          </p>
        )}
        <div className={styles.stats}>
          <div>
            <small>Toplam seçenek</small>
            <strong>{variants.length}</strong>
          </div>
          <div>
            <small>Aktif stok toplamı</small>
            <strong>{totalStock}</strong>
          </div>
          <div>
            <small>Az stoklu seçenek</small>
            <strong>{lowStock}</strong>
          </div>
        </div>
        <div className={styles.panel}>
          <h2>Renk ve ölçü seçenekleri</h2>
          {!variants.length ? (
            <p>Henüz varyant eklenmemiş.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Seçenek</th>
                    <th>Fiyat</th>
                    <th>Stok</th>
                    <th>Yayın</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className={styles.variantName}>
                          {v.imageUrl ? (
                            <Image width={64} height={64} src={v.imageUrl} alt="" />
                          ) : (
                            <Package size={22} />
                          )}
                          <div>
                            <strong>{[v.color, v.size].filter(Boolean).join(' / ')}</strong>
                            <small>{v.sku ?? 'SKU yok'}</small>
                          </div>
                        </div>
                      </td>
                      <td>{formatPrice(v.price)}</td>
                      <td>{v.stock_quantity} adet</td>
                      <td>{v.is_active ? 'Aktif' : 'Pasif'}</td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" onClick={() => openEdit(v)}>
                            Düzenle
                          </button>
                          <button type="button" onClick={() => openStock(v)}>
                            Stok
                          </button>
                          {v.is_active && (
                            <button type="button" onClick={() => void disable(v)}>
                              <Trash2 size={15} /> Pasifleştir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className={styles.panel}>
          <h2>Son varyant stok hareketleri</h2>
          {!movements.length ? (
            <p>Henüz kayıt yok.</p>
          ) : (
            movements.map((m) => (
              <div key={m.id} className={styles.movement}>
                <span>
                  {variants.find((v) => v.id === m.variant_id)?.color}{' '}
                  {variants.find((v) => v.id === m.variant_id)?.size}
                </span>
                <strong>
                  {m.change_quantity > 0 ? '+' : ''}
                  {m.change_quantity}
                </strong>
                <small>
                  {m.note ?? 'Stok değişikliği'} · {new Date(m.created_at).toLocaleString('tr-TR')}
                </small>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <div className="admin-modal-backdrop">
          <div
            className="admin-modal admin-modal-large"
            role="dialog"
            aria-modal="true"
            aria-label="Varyant düzenle"
          >
            <div className="admin-modal-heading">
              <h2>{editing === 'new' ? 'Yeni varyant' : 'Varyant düzenle'}</h2>
              <button type="button" aria-label="Kapat" onClick={() => setEditing(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save} className="admin-product-form">
              <label className="admin-field">
                Renk
                <input
                  maxLength={60}
                  placeholder="Mavi"
                  value={form.color}
                  onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                Boyut / ölçü
                <input
                  maxLength={60}
                  placeholder="A5"
                  value={form.size}
                  onChange={(e) => setForm((s) => ({ ...s, size: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                Varyant kodu (isteğe bağlı)
                <input
                  value={form.sku}
                  onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                Satış fiyatı ₺ *
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
                Eski fiyat
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.compare}
                  onChange={(e) => setForm((s) => ({ ...s, compare: e.target.value }))}
                />
              </label>
              {editing === 'new' && (
                <label className="admin-field">
                  İlk stok miktarı *
                  <input
                    required
                    min="0"
                    step="1"
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm((s) => ({ ...s, stock: e.target.value }))}
                  />
                </label>
              )}
              <label className="admin-field">
                Az stok uyarı limiti *
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.threshold}
                  onChange={(e) => setForm((s) => ({ ...s, threshold: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <ImagePlus size={16} /> Seçeneğe özel fotoğraf
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
                />{' '}
                Satışta göster
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
                <Save size={16} />
                {pending ? 'Kaydediliyor...' : 'Varyantı kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
      {selected && (
        <div className="admin-modal-backdrop">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Varyant stok değişikliği"
          >
            <div className="admin-modal-heading">
              <h2>Varyant stok</h2>
              <button type="button" aria-label="Kapat" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveStock} className={styles.stockForm}>
              <p>
                {[selected.color, selected.size].filter(Boolean).join(' / ')} ·{' '}
                {selected.stock_quantity} adet
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => setDirection('increase')}
                  aria-pressed={direction === 'increase'}
                >
                  + Artır
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('decrease')}
                  aria-pressed={direction === 'decrease'}
                >
                  − Azalt
                </button>
              </div>
              <label>
                Miktar
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100000"
                  required
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                />
              </label>
              <label>
                Açıklama
                <input maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              {error && (
                <p role="alert" className="admin-form-error">
                  {error}
                </p>
              )}
              <button type="submit" className="button button-primary" disabled={pending}>
                <Check size={16} /> Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
