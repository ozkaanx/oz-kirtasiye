'use client';

import { CustomerPagination } from './customer-pagination';
import type { CustomerPage } from '@/lib/customer-pagination';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, PackageCheck, RotateCcw } from 'lucide-react';
import { AccountSubpage } from './account-subpage';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import {
  RETURN_KIND,
  RETURN_REASONS,
  RETURN_STATUS,
  returnDate,
  type ReturnHistory,
  type ReturnKind,
  type ReturnOrder,
  type ReturnReason,
  type ReturnRequest,
} from '@/lib/returns';
import styles from './customer-returns.module.css';

type Props = {
  ordersMeta: CustomerPage;
  requestsMeta: CustomerPage;
  orders: ReturnOrder[];
  requests: ReturnRequest[];
  history: ReturnHistory[];
  loadError: string | null;
};

export function CustomerReturns({
  orders,
  requests,
  history,
  loadError,
  ordersMeta,
  requestsMeta,
}: Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [kind, setKind] = useState<ReturnKind>('return');
  const [reason, setReason] = useState<ReturnReason>('changed_mind');
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const order = orders.find((o) => o.id === selectedOrder);
  const item = order?.order_request_items.find((i) => i.id === selectedItem);
  const previouslyClaimed = item?.claimed_quantity ?? 0;
  const remaining = Math.max(0, (item?.quantity ?? 0) - previouslyClaimed);

  function chooseOrder(id: string) {
    setSelectedOrder(id);
    setSelectedItem('');
    setQuantity(1);
    setError('');
  }
  function chooseItem(id: string) {
    setSelectedItem(id);
    setQuantity(1);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !selectedOrder || !selectedItem || remaining < quantity) return;
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      const { error: requestError } = await supabase.rpc('customer_request_return', {
        p_order_id: selectedOrder,
        p_item_id: selectedItem,
        p_quantity: quantity,
        p_request_type: kind,
        p_reason: reason,
        p_note: note.trim(),
      });
      if (requestError) throw new Error(requestError.message);
      setSuccess('Talebin alındı. Mağaza incelemesinin sonucunu bu sayfadan takip edebilirsin.');
      setSelectedOrder('');
      setSelectedItem('');
      setQuantity(1);
      setNote('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Talep oluşturulamadı.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <AccountSubpage
      active="returns"
      title="İade ve değişim"
      description="Teslim aldığın ürünler için talep oluşturabilir, değerlendirme sürecini izleyebilirsin."
      icon={<RotateCcw />}
    >
      {loadError && (
        <p role="alert" className={styles.error}>
          Bilgiler yüklenemedi: {loadError}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" className={styles.success}>
          {success}
        </p>
      )}
      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="new-return">
          <h2 id="new-return">
            <ClipboardCheck size={20} /> Yeni talep oluştur
          </h2>
          <p className={styles.hint}>
            Sadece hesabına bağlı, teslim edildi durumundaki siparişler burada listelenir. Misafir
            siparişleri için mağazayla iletişime geçebilirsin.
          </p>
          {orders.length === 0 ? (
            <p className={styles.empty}>
              İade/değişim talebi açılabilecek teslim edilmiş siparişin bulunmuyor.
            </p>
          ) : (
            <>
              <CustomerPagination
                result={ordersMeta}
                path="/hesabim/iade"
                pageKey="ordersPage"
                params={{ requestsPage: String(requestsMeta.page) }}
                label="İade edilebilir sipariş sayfaları"
              />
              <form onSubmit={submit} className={styles.form}>
                <label>
                  Sipariş
                  <select
                    required
                    value={selectedOrder}
                    onChange={(e) => chooseOrder(e.target.value)}
                  >
                    <option value="">Sipariş seç</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.reference} · {returnDate(o.created_at)}
                      </option>
                    ))}
                  </select>
                </label>
                {order && (
                  <label>
                    Ürün / varyant
                    <select
                      required
                      value={selectedItem}
                      onChange={(e) => chooseItem(e.target.value)}
                    >
                      <option value="">Ürün seç</option>
                      {order.order_request_items.map((i) => {
                        const available = Math.max(0, i.quantity - i.claimed_quantity);
                        return (
                          <option value={i.id} key={i.id} disabled={available <= 0}>
                            {i.product_name}
                            {i.variant_label ? ` · ${i.variant_label}` : ''} · {available} adet
                            talep hakkı
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
                <div className={styles.twoCol}>
                  <label>
                    İşlem türü
                    <select value={kind} onChange={(e) => setKind(e.target.value as ReturnKind)}>
                      <option value="return">İade</option>
                      <option value="exchange">Değişim</option>
                    </select>
                  </label>
                  <label>
                    Adet
                    <input
                      type="number"
                      min={1}
                      max={remaining || 1}
                      required
                      value={quantity}
                      disabled={!item || !remaining}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                </div>
                <label>
                  Talep nedeni
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReturnReason)}
                  >
                    {Object.entries(RETURN_REASONS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Açıklaman
                  <textarea
                    required
                    rows={4}
                    minLength={10}
                    maxLength={1000}
                    placeholder="Ürünün durumunu ve talebini en az 10 karakterle anlat."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  className="button button-primary"
                  disabled={
                    working || !item || remaining < 1 || quantity > remaining || quantity < 1
                  }
                  type="submit"
                >
                  {working ? 'Gönderiliyor...' : 'Talep oluştur'}
                </button>
                <p className={styles.hint}>
                  Talep oluşturulması otomatik para iadesi veya değişim ürünü gönderimi anlamına
                  gelmez. Mağaza seninle iletişime geçer.
                </p>
              </form>
            </>
          )}
        </section>
        <section className={styles.card} aria-labelledby="my-returns">
          <h2 id="my-returns">
            <PackageCheck size={20} /> Taleplerim
          </h2>
          {requests.length === 0 && !loadError && (
            <p className={styles.empty}>Henüz iade veya değişim talebin yok.</p>
          )}
          <div className={styles.list}>
            {requests.map((r) => {
              const linkedOrder = orders.find((o) => o.id === r.order_request_id);
              const line = linkedOrder?.order_request_items.find((i) => i.id === r.order_item_id);
              const timeline = history.filter((h) => h.return_request_id === r.id);
              return (
                <article key={r.id} className={styles.returnCard}>
                  <div className={styles.returnHead}>
                    <strong>
                      {RETURN_KIND[r.request_type]} · {r.quantity} adet
                    </strong>
                    <span className={styles.status}>{RETURN_STATUS[r.status]}</span>
                  </div>
                  <p>
                    {r.product_name
                      ? `${r.product_name}${r.variant_label ? ` · ${r.variant_label}` : ''}`
                      : line
                        ? `${line.product_name}${line.variant_label ? ` · ${line.variant_label}` : ''}`
                        : `Sipariş #${r.order_reference ?? r.order_request_id.slice(0, 8)}`}
                  </p>
                  <small>
                    {returnDate(r.created_at)} · {RETURN_REASONS[r.reason]}
                  </small>
                  <p className={styles.customerNote}>{r.customer_note}</p>
                  {r.admin_note && (
                    <p className={styles.adminNote}>
                      <b>Mağaza notu:</b> {r.admin_note}
                    </p>
                  )}
                  {r.restocked_quantity > 0 && (
                    <small>Fiziksel kontrol sonrası stok kaydı güncellendi.</small>
                  )}
                  {timeline.length > 0 && (
                    <details className={styles.timeline}>
                      <summary>İşlem geçmişi ({timeline.length})</summary>
                      {timeline.map((h) => (
                        <p key={h.id}>
                          <b>{RETURN_STATUS[h.to_status]}</b> · {returnDate(h.created_at)}
                          {h.note ? ` — ${h.note}` : ''}
                        </p>
                      ))}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
          <CustomerPagination
            result={requestsMeta}
            path="/hesabim/iade"
            pageKey="requestsPage"
            params={{ ordersPage: String(ordersMeta.page) }}
            label="İade talebi sayfaları"
          />
        </section>
      </div>
    </AccountSubpage>
  );
}
