'use client';
import { AdminDialog } from './admin-dialog';
import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { validateStockAdjustment } from '@/lib/admin-catalog-validation';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { Product } from './admin-product-types';
function errorText(err: unknown) {
  return err instanceof Error ? err.message : 'İşlem başarısız oldu.';
}
export function AdminProductStockDialog({
  selected,
  onClose,
  onSaved,
}: {
  selected: Product;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [stockDelta, setStockDelta] = useState('1');
  const [stockDirection, setStockDirection] = useState<'add' | 'remove'>('add');
  const [stockNote, setStockNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const prediction = validateStockAdjustment(
    stockDelta,
    selected.stock_quantity,
    stockDirection === 'add' ? 'increase' : 'decrease',
  );
  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    const validated = validateStockAdjustment(
      stockDelta,
      selected.stock_quantity,
      stockDirection === 'add' ? 'increase' : 'decrease',
    );
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setPending(true);
    setError('');
    try {
      const { error } = await createBrowserSupabase().rpc('adjust_product_stock', {
        p_product_id: selected.id,
        p_change: validated.value.change,
        p_note: stockNote.trim() || null,
      });
      if (error) throw error;

      onSaved('Stok değişikliği veritabanına kaydedildi.');
      router.refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <AdminDialog className="admin-modal" label="Stok güncelle" busy={pending} onClose={onClose}>
      <div className="admin-modal-heading">
        <h2>Stok güncelle</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="Kapat">
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
          <strong>{prediction.ok ? `${prediction.value.resultingStock} adet` : '—'}</strong>
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
    </AdminDialog>
  );
}
