'use client';

import { type FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';

import { useRouter } from 'next/navigation';
import { Boxes, Check, ChevronRight, FolderTree, Pencil, Plus, X } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

import {
  CATEGORY_ARTWORK,
  categoryArtwork,
  descendantIds,
  flattenCategories,
  slugifyTurkish,
  type StoreCategory,
} from '@/lib/category-utils';

type FormData = {
  name: string;
  slug: string;
  description: string;
  parent_id: string;
  image_path: string;
  sort_order: string;
  is_active: boolean;
};
const EMPTY_FORM: FormData = {
  name: '',
  slug: '',
  description: '',
  parent_id: '',
  image_path: '',
  sort_order: '0',
  is_active: true,
};

type Props = {
  categories: StoreCategory[];
  productCounts: Record<string, number> | null;
  loadError: string | null;
};

export function AdminCategories({ categories, productCounts, loadError }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<StoreCategory | 'new' | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  const ordered = useMemo(() => flattenCategories(categories), [categories]);
  const rows = ordered.filter(({ category }) =>
    `${category.name} ${category.slug}`
      .toLocaleLowerCase('tr-TR')
      .includes(search.toLocaleLowerCase('tr-TR')),
  );
  const blockedParents =
    editing && editing !== 'new' ? descendantIds(categories, editing.id) : new Set<string>();

  function create(parentId = '') {
    setEditing('new');
    setForm({ ...EMPTY_FORM, parent_id: parentId, sort_order: String(categories.length * 10) });
    setError('');
    setNotice('');
  }

  function edit(category: StoreCategory) {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parent_id: category.parent_id ?? '',
      image_path: category.image_path ?? '',
      sort_order: String(category.sort_order),
      is_active: category.is_active,
    });
    setError('');
    setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !editing) return;
    const slug = slugifyTurkish(form.slug);
    const sortOrder = Number(form.sort_order);
    if (!form.name.trim() || !slug || !Number.isInteger(sortOrder) || sortOrder < 0) {
      setError('Geçerli kategori adı, URL ve sıralama sayısı girmelisin.');
      return;
    }
    if (form.parent_id && blockedParents.has(form.parent_id)) {
      setError('Kategori kendisinin veya alt kategorilerinin altında yer alamaz.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        slug,
        description: form.description.trim() || null,
        parent_id: form.parent_id || null,
        image_path: form.image_path || null,
        sort_order: sortOrder,
        is_active: form.is_active,
      };
      const supabase = createBrowserSupabase();
      if (editing === 'new') {
        const { error: dbError } = await supabase
          .from('categories')
          .insert(payload)
          .select('id')
          .single();
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editing.id)
          .select('id')
          .single();
        if (dbError) throw dbError;
      }
      setEditing(null);
      setNotice('Kategori başarıyla kaydedildi.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kategori kaydedilemedi.');
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(category: StoreCategory) {
    if (pending) return;
    setError('');
    setNotice('');
    setPending(true);
    try {
      const { error: dbError } = await createBrowserSupabase()
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id)
        .select('id')
        .single();
      if (dbError) throw dbError;
      setNotice(category.is_active ? 'Kategori yayından kaldırıldı.' : 'Kategori yayınlandı.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kategori güncellenemedi.');
    } finally {
      setPending(false);
    }
  }

  const preview: StoreCategory = {
    id: '',
    parent_id: null,
    name: form.name,
    slug: form.slug,
    description: null,
    image_path: form.image_path || null,
    sort_order: 0,
    is_active: true,
  };

  return (
    <>
      <div className="admin-body">
        <div className="admin-page-heading">
          <div>
            <span className="section-eyebrow">ÖZ KIRTASİYE · GERÇEK VERİLER</span>
            <h1>
              Kategori yönetimi<span className="orange-dot">.</span>
            </h1>
            <p>Ana kategorileri ve alt kategorileri buradan yönetebilirsin.</p>
          </div>
          <button type="button" className="button button-primary" onClick={() => create()}>
            <Plus size={17} /> Yeni kategori
          </button>
        </div>
        {loadError && <p className="admin-form-error">Veri okuma hatası: {loadError}</p>}
        {notice && (
          <p className="admin-form-success" role="status">
            {notice}
          </p>
        )}
        {!editing && error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-category-summary">
          <div>
            <FolderTree size={22} />
            <strong>{productCounts ? categories.length : '—'}</strong>
            <span>Toplam kategori</span>
          </div>
          <div>
            <Check size={22} />
            <strong>{productCounts ? categories.filter((c) => c.is_active).length : '—'}</strong>
            <span>Aktif kategori</span>
          </div>
          <div>
            <Boxes size={22} />
            <strong>{productCounts ? categories.filter((c) => c.parent_id).length : '—'}</strong>
            <span>Alt kategori</span>
          </div>
        </div>
        <div className="admin-content-box">
          <div className="admin-category-toolbar">
            <div className="admin-search">
              <input
                aria-label="Kategori ara"
                placeholder="Kategori ara..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span>
              Ürün sayıları doğrudan kategoriye bağlı tüm ürünleri kapsar; alt kategoriler ayrı
              sayılır.
            </span>
          </div>
          {rows.length ? (
            <div className="admin-category-table-wrap">
              <table className="admin-table admin-category-table">
                <thead>
                  <tr>
                    <th>KATEGORİ</th>
                    <th>ÜRÜN</th>
                    <th>SIRA</th>
                    <th>DURUM</th>
                    <th>İŞLEM</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ category, depth }) => (
                    <tr key={category.id}>
                      <td>
                        <div
                          className="admin-category-name"
                          style={{ paddingLeft: `${depth * 21}px` }}
                        >
                          {depth > 0 && <ChevronRight size={14} color="#a4a8b1" />}
                          <Image src={categoryArtwork(category)} width={40} height={40} alt="" />
                          <span>
                            <strong>{category.name}</strong>
                            <small>/{category.slug}</small>
                          </span>
                        </div>
                      </td>
                      <td>{productCounts ? (productCounts[category.id] ?? 0) : '—'}</td>
                      <td>{category.sort_order}</td>
                      <td>
                        <span className={`admin-status ${category.is_active ? 'in' : 'out'}`}>
                          {category.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-action-group">
                          <button
                            className="admin-edit"
                            type="button"
                            onClick={() => edit(category)}
                          >
                            <Pencil size={14} /> Düzenle
                          </button>
                          <button
                            className="admin-edit"
                            type="button"
                            title="Alt kategori ekle"
                            aria-label={`${category.name} alt kategorisi ekle`}
                            onClick={() => create(category.id)}
                          >
                            <Plus size={14} /> Alt kategori
                          </button>
                          <button
                            className="admin-edit"
                            type="button"
                            disabled={pending}
                            onClick={() => toggleActive(category)}
                          >
                            {category.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-no-results">
              <FolderTree size={32} />
              <h3>{search ? 'Aradığın kategori bulunamadı' : 'Henüz kategori oluşturulmadı'}</h3>
              {!search && <p>Önce ana kategori, ardından istersen alt kategorilerini ekle.</p>}
            </div>
          )}
        </div>
        <p className="admin-category-help">
          Pasif kategoriler ve bu kategorilerin alt kategorileri müşteriye gösterilmez. Ancak
          kategorideki ürünlerin yayın durumu ayrıca ürün yönetiminden değiştirilmelidir.
        </p>
      </div>

      {editing && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setEditing(null);
          }}
        >
          <div
            className="admin-modal admin-modal-large"
            role="dialog"
            aria-modal="true"
            aria-label="Kategori düzenleme formu"
          >
            <div className="admin-modal-heading">
              <h2>{editing === 'new' ? 'Yeni kategori' : 'Kategori düzenle'}</h2>
              <button
                type="button"
                aria-label="Kapat"
                disabled={pending}
                onClick={() => setEditing(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form className="admin-product-form" onSubmit={save}>
              <label className="admin-field">
                Kategori adı *
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      name: event.target.value,
                      slug: editing === 'new' ? slugifyTurkish(event.target.value) : old.slug,
                    }))
                  }
                />
              </label>
              <label className="admin-field">
                URL (slug) *
                <input
                  required
                  maxLength={120}
                  value={form.slug}
                  onChange={(event) => setForm((old) => ({ ...old, slug: event.target.value }))}
                />
              </label>
              <label className="admin-field">
                Üst kategori
                <select
                  value={form.parent_id}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, parent_id: event.target.value }))
                  }
                >
                  <option value="">Ana kategori (üst kategori yok)</option>
                  {ordered
                    .filter(({ category }) => !blockedParents.has(category.id))
                    .map(({ category, depth }) => (
                      <option key={category.id} value={category.id}>
                        {'— '.repeat(depth)}
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="admin-field">
                Görsel
                <select
                  value={form.image_path}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, image_path: event.target.value }))
                  }
                >
                  <option value="">Otomatik seç</option>
                  {CATEGORY_ARTWORK.map((artwork) => (
                    <option key={artwork.path} value={artwork.path}>
                      {artwork.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                Sıra numarası *
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, sort_order: event.target.value }))
                  }
                />
              </label>
              <div className="admin-category-preview">
                <Image
                  src={categoryArtwork(preview)}
                  width={58}
                  height={58}
                  alt="Kategori görseli önizlemesi"
                />
                <span>Seçilen kategori görseli</span>
              </div>
              <label className="admin-field admin-form-wide">
                Açıklama
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, description: event.target.value }))
                  }
                />
              </label>
              <label className="admin-checkbox admin-form-wide">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, is_active: event.target.checked }))
                  }
                />
                Sitede yayınla
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
                <Check size={18} /> {pending ? 'Kaydediliyor...' : 'Kategoriyi kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
