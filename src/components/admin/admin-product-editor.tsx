'use client';
import { saveProductImage, type ProductSaveProgress } from '@/lib/product-save';
import { AdminDialog } from './admin-dialog';
import { type FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import {
  validateCatalogNumbers,
  validateCatalogImage,
  validateCostPrice,
} from '@/lib/admin-catalog-validation';
import { estimateProductProfit } from '@/lib/admin-product-profit';
import { formatPrice } from '@/lib/format';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { flattenCategories, slugifyTurkish } from '@/lib/category-utils';
import type { Category, Product, ProductForm } from './admin-product-types';
const emptyForm: ProductForm = {
  name: '',
  slug: '',
  description: '',
  category_id: '',
  sku: '',
  price: '',
  compare_at_price: '',
  cost_price: '',
  stock_quantity: '0',
  low_stock_threshold: '5',
  is_active: false,
  is_featured: false,
};
function errorText(err: unknown) {
  return err instanceof Error ? err.message : 'İşlem başarısız oldu.';
}
export function AdminProductEditor({
  editing,
  categories,
  onClose,
  onSaved,
}: {
  editing: Product | 'new';
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const productIdRef = useRef<string | null>(editing === 'new' ? null : editing.id);
  const lock = useRef(false);
  const imageRecordId = useRef<string | null>(null);
  const imageProgress = useRef<ProductSaveProgress>({ photo: null, path: null, uploaded: false });
  const [form, setForm] = useState<ProductForm>(() =>
    editing === 'new'
      ? emptyForm
      : {
          name: editing.name,
          slug: editing.slug,
          description: editing.description ?? '',
          category_id: editing.category_id ?? '',
          sku: editing.sku ?? '',
          price: String(editing.price),
          compare_at_price:
            editing.compare_at_price == null ? '' : String(editing.compare_at_price),
          cost_price: editing.cost_price == null ? '' : String(editing.cost_price),
          stock_quantity: String(editing.stock_quantity),
          low_stock_threshold: String(editing.low_stock_threshold),
          is_active: editing.is_active,
          is_featured: editing.is_featured,
        },
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (!form.name.trim() || !slugifyTurkish(form.slug)) {
      setError('Geçerli ürün adı ve URL girin.');
      return;
    }
    const validated = validateCatalogNumbers(
      {
        price: form.price,
        compare: form.compare_at_price,
        stock: editing === 'new' ? form.stock_quantity : '0',
        threshold: form.low_stock_threshold,
      },
      'product',
    );
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    const { price, compare, stock, threshold } = validated.value;
    const costCheck = validateCostPrice(form.cost_price);
    if (!costCheck.ok) {
      setError(costCheck.error);
      return;
    }
    const cost = costCheck.value;
    const imageError = validateCatalogImage(photo);
    if (imageError) {
      setError(imageError);
      return;
    }
    const current = editing;
    if (!current) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const supabase = createBrowserSupabase();
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
      productIdRef.current ??= crypto.randomUUID();
      const productId = productIdRef.current;
      const { error: saveError } = await supabase.rpc('admin_save_product', {
        p_id: productId,
        p_product: { ...payload, stock_quantity: stock },
        p_cost: cost,
      });
      if (saveError)
        throw new Error(
          saveError.code === '23505'
            ? 'Bu ürün kodu veya URL zaten kullanılıyor. Lütfen kontrol edin.'
            : 'Ürün ve maliyet kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.',
        );
      if (photo) {
        const extension =
          photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
        await saveProductImage(imageProgress.current, photo, {
          makePath: () => productId + '/' + crypto.randomUUID() + '.' + extension,
          upload: (path, file) =>
            supabase.storage
              .from('product-images')
              .upload(path, file, { contentType: file.type, upsert: true }),
          recorded: async (path) => {
            const result = await supabase
              .from('product_images')
              .select('id')
              .eq('storage_path', path)
              .eq('id', imageRecordId.current!)
              .maybeSingle();
            return { error: result.error, found: !!result.data };
          },
          remove: (path) => supabase.storage.from('product-images').remove([path]),
          record: (path) =>
            supabase.from('product_images').upsert(
              {
                id: (imageRecordId.current ??= crypto.randomUUID()),
                product_id: productId,
                storage_path: path,
                sort_order: 0,
                alt_text: form.name.trim(),
              },
              { onConflict: 'id' },
            ),
        });
      }

      onSaved("Ürün Supabase'e kaydedildi.");
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
      router.refresh();
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <AdminDialog
      className="admin-modal admin-modal-large"
      label="Ürün formu"
      busy={pending}
      onClose={onClose}
    >
      <div className="admin-modal-heading">
        <h2>{editing === 'new' ? 'Yeni ürün ekle' : 'Ürün düzenle'}</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Kapat">
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
              <option key={c.id} value={c.id} disabled={!c.is_active && form.category_id !== c.id}>
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
        {editing !== 'new' && editing.has_variants ? (
          <p className="admin-category-help">
            Varyantlı ürünlerde alış maliyeti ve kâr hesabı bu aşamada yapılmaz.
          </p>
        ) : (
          <label className="admin-field">
            Alış maliyeti (₺, yöneticiye özel)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cost_price}
              placeholder="Bilinmiyorsa boş bırak"
              onChange={(e) => setForm((s) => ({ ...s, cost_price: e.target.value }))}
            />
            {(() => {
              const price = Number(form.price);
              const check = validateCostPrice(form.cost_price);
              const result = check.ok ? estimateProductProfit(price, check.value) : null;
              return result ? (
                <small>
                  Tahmini brüt fark: {formatPrice(result.difference)}
                  {result.marginPercent !== null ? ` · Marj: %${result.marginPercent}` : ''} (KDV /
                  kargo / komisyon hariç)
                </small>
              ) : null;
            })()}
          </label>
        )}
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
        <button type="submit" disabled={pending} className="button button-primary admin-form-wide">
          <Check size={18} />
          {pending ? 'Kaydediliyor...' : 'Ürünü kaydet'}
        </button>
      </form>
    </AdminDialog>
  );
}
