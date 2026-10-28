'use client';
import { AdminDialog } from './admin-dialog';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, UploadCloud, X, AlertTriangle } from 'lucide-react';
import { IMPORT_TEMPLATE_CSV } from '@/lib/admin-bulk-import';
import { formatPrice } from '@/lib/format';
import styles from './admin-product-import.module.css';

type PreviewItem = {
  sku: string;
  name?: string;
  price?: number;
  cost_price?: number;
  stock_quantity?: number;
  category_slug?: string;
  action: 'create' | 'update';
  row: number;
  previous_stock?: number | null;
  previous_price?: number | null;
};
type Result = { created: number; updated: number; rows: PreviewItem[]; expected: unknown[] };

export function AdminProductImport({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [allowStockUpdates, setAllowStockUpdates] = useState(false);
  const [preview, setPreview] = useState<Result | null>(null);
  const [pending, setPending] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState('');

  function downloadTemplate() {
    const objectUrl = URL.createObjectURL(
      new Blob([IMPORT_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'oz-kirtasiye-urun-sablonu.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function process(mode: 'preview' | 'commit') {
    if (!file || lock.current) return;
    if (mode === 'commit' && !preview) return;
    lock.current = true;
    setPending(mode);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('mode', mode);
      if (mode === 'commit') form.set('expected', JSON.stringify(preview!.expected));
      form.set('allowStockUpdates', allowStockUpdates ? 'true' : 'false');
      const response = await fetch('/api/admin/product-import', {
        method: 'POST',
        body: form,
        cache: 'no-store',
      });
      const json = (await response.json()) as Result & { message?: string };
      if (!response.ok && mode === 'commit') setPreview(null);
      if (!response.ok) throw new Error(json.message ?? 'Dosya aktarımı başarısız oldu.');
      if (mode === 'preview') setPreview(json);
      else {
        onSaved(
          `Toplu aktarım tamamlandı: ${json.created} ürün eklendi, ${json.updated} ürün güncellendi.`,
        );
        onClose();
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dosya aktarımı başarısız oldu.');
      if (mode === 'preview') setPreview(null);
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  return (
    <AdminDialog
      className={styles.modal}
      label="Excel / CSV aktarımı"
      busy={!!pending}
      onClose={onClose}
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>KATALOG · TOPLU ÜRÜN YÖNETİMİ</span>
          <h2 id="product-import-title">
            <FileSpreadsheet size={23} /> Excel / CSV aktarımı
          </h2>
        </div>
        <button
          type="button"
          aria-label="Pencereyi kapat"
          disabled={!!pending}
          onClick={onClose}
          className={styles.close}
        >
          <X size={22} />
        </button>
      </header>
      <div className={styles.content}>
        <div className={styles.instructions}>
          <p>
            <strong>SKU (ürün kodu) üzerinden eşleştirme:</strong> Mevcut SKU güncellenir, yeni SKU
            ürün oluşturur. Dosyada boş bırakılan alanlar mevcut üründe değiştirilmez.
          </p>
          <p>
            Excel <b>.xlsx</b> veya UTF-8 <b>.csv</b> · İlk sayfa · En fazla 200 satır / 2 MB.
          </p>
          <p>
            Yeni ürünler, yayın durumu belirtilmedikçe <b>pasif</b> oluşturulur. Varyantlı ürünleri
            kendi ekranlarından yönetin.
          </p>
          <button type="button" onClick={downloadTemplate} className={styles.template}>
            <Download size={17} /> Örnek CSV şablonunu indir
          </button>
        </div>

        <label className={styles.upload}>
          <UploadCloud size={28} aria-hidden="true" />
          <strong>{file?.name ?? 'Excel veya CSV dosyası seç'}</strong>
          <span>Dosyayı seçtikten sonra önce önizleme alınır.</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!!pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setError('');
            }}
          />
        </label>
        <label className={styles.stockOption}>
          <input
            type="checkbox"
            checked={allowStockUpdates}
            disabled={!!pending}
            onChange={(event) => {
              setAllowStockUpdates(event.target.checked);
              setPreview(null);
            }}
          />
          <span>
            <strong>Mevcut ürün stoklarını da güncelle</strong>
            <small>
              İşaretlenirse dosyada stok yazan ürünlerin envanteri değişir ve stok hareketleri kayda
              geçer. Varsayılan kapalıdır.
            </small>
          </span>
        </label>
        <div className={styles.warning}>
          <AlertTriangle size={19} aria-hidden="true" />
          <span>
            Alış maliyeti yalnızca yönetici panelinde görünür. Brüt fark hesapları KDV, kargo,
            komisyon ve genel giderleri içermez.
          </span>
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {preview && (
          <section className={styles.preview} aria-label="Aktarım önizlemesi">
            <div className={styles.summary}>
              <strong>Önizleme</strong>
              <span>
                <b>{preview.created}</b> yeni · <b>{preview.updated}</b> güncelleme
              </span>
            </div>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Satır</th>
                    <th>SKU</th>
                    <th>İşlem</th>
                    <th>Ürün</th>
                    <th>Satış</th>
                    <th>Maliyet</th>
                    <th>Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row + 1}</td>
                      <td>
                        <code>{row.sku}</code>
                      </td>
                      <td>
                        <span className={row.action === 'create' ? styles.create : styles.update}>
                          {row.action === 'create' ? 'Yeni' : 'Güncelle'}
                        </span>
                      </td>
                      <td>{row.name ?? 'Değişmeyecek'}</td>
                      <td>
                        {typeof row.price === 'number'
                          ? `${row.previous_price == null ? 'Yeni' : formatPrice(row.previous_price)} → ${formatPrice(row.price)}`
                          : '—'}
                      </td>
                      <td>
                        {typeof row.cost_price === 'number' ? formatPrice(row.cost_price) : '—'}
                      </td>
                      <td>
                        {typeof row.stock_quantity === 'number'
                          ? `${row.previous_stock ?? 'Yeni'} → ${row.stock_quantity}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.hint}>
              Önizleme henüz veri değiştirmez. Onay sırasında dosya ve mevcut ürünler yeniden
              kontrol edilir; hata olursa işlem bütünüyle geri alınır.
            </p>
          </section>
        )}
      </div>
      <footer className={styles.actions}>
        <button
          type="button"
          className="button button-outline"
          disabled={!!pending}
          onClick={onClose}
        >
          Vazgeç
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={!file || !!pending}
          onClick={() => void process('preview')}
        >
          {pending === 'preview' ? 'Kontrol ediliyor…' : 'Dosyayı kontrol et'}
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={!preview || !!pending}
          onClick={() => void process('commit')}
        >
          {pending === 'commit' ? 'Aktarılıyor…' : 'Onayla ve aktar'}
        </button>
      </footer>
    </AdminDialog>
  );
}
