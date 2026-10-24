'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, LogOut, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { AdminSidebar } from './admin-sidebar';
import {
  RETURN_KIND,
  RETURN_REASONS,
  RETURN_STATUS,
  returnDate,
  type AdminReturnRequest,
  type ReturnStatus,
} from '@/lib/returns';
import styles from './admin-returns.module.css';

type Action = 'approve' | 'reject' | 'receive' | 'close';
type Condition = 'resellable' | 'damaged' | 'unknown';

export function AdminReturns({
  entries,
  loadError,
}: {
  entries: AdminReturnRequest[];
  loadError: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('approve');
  const [note, setNote] = useState('');
  const [condition, setCondition] = useState<Condition>('unknown');
  const [restock, setRestock] = useState(false);
  const [invoiceReviewed, setInvoiceReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
        const text = query.toLocaleLowerCase('tr-TR').trim();
        return (
          !text ||
          `${entry.order?.reference ?? ''} ${entry.order?.customer_name ?? ''} ${entry.order?.phone ?? ''} ${entry.item?.product_name ?? ''}`
            .toLocaleLowerCase('tr-TR')
            .includes(text)
        );
      }),
    [entries, statusFilter, query],
  );
  const counts = {
    requested: entries.filter((r) => r.status === 'requested').length,
    approved: entries.filter((r) => r.status === 'approved').length,
    received: entries.filter((r) => r.status === 'received').length,
    closed: entries.filter((r) => r.status === 'closed').length,
  };

  function openForm(id: string, next: Action) {
    setActive(id);
    setAction(next);
    setNote('');
    setCondition('unknown');
    setRestock(false);
    setInvoiceReviewed(false);
    setError('');
    setSuccess('');
  }
  function closeForm() {
    setActive(null);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>, entry: AdminReturnRequest) {
    event.preventDefault();
    if (busy || active !== entry.id) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const { error: rpcError } = await supabase.rpc('admin_handle_return_request', {
        p_return_id: entry.id,
        p_action: action,
        p_note: note.trim() || null,
        p_condition: action === 'close' ? condition : null,
        p_restock: action === 'close' ? restock : false,
        p_invoice_reviewed: action === 'close' ? invoiceReviewed : false,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess(
        `Talep güncellendi: ${action === 'approve' ? 'onaylandı' : action === 'reject' ? 'reddedildi' : action === 'receive' ? 'ürün teslim alındı' : 'işlem kapatıldı'}.`,
      );
      setActive(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Talep güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
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
          <button type="button" className="admin-logout" onClick={() => void logout()}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
        <main className="admin-body">
          <div className="admin-page-heading">
            <div>
              <span className="section-eyebrow">ÖZ KIRTASİYE / İADE YÖNETİMİ</span>
              <h1>
                İade ve değişim<span className="orange-dot">.</span>
              </h1>
              <p>
                Müşteri taleplerini değerlendir; ürün teslimini, fiziksel kontrolü ve stok kararını
                ayrı kaydet.
              </p>
            </div>
          </div>
          <section className={styles.root}>
            <div className={styles.warning}>
              <ShieldCheck size={19} />
              <span>
                <strong>İş akışı güvenliği:</strong> Onaylamak stok artırmaz. Ürün önce fiziksel
                olarak teslim alınır; yalnızca satılabilir ürün için kapanışta stok eklenebilir. Bu
                panel para iadesi, e-belge iptali veya değişim ürünü gönderimi yapmaz.
              </span>
            </div>
            {loadError && (
              <p role="alert" className={styles.error}>
                Kayıtlar yüklenemedi: {loadError}
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
            <div className={styles.metrics}>
              <div>
                <small>Yeni talepler</small>
                <strong>{counts.requested}</strong>
              </div>
              <div>
                <small>Onaylanan</small>
                <strong>{counts.approved}</strong>
              </div>
              <div>
                <small>Ürün teslim alındı</small>
                <strong>{counts.received}</strong>
              </div>
              <div>
                <small>Kapatılan</small>
                <strong>{counts.closed}</strong>
              </div>
            </div>
            <div className={styles.filterBar}>
              <label>
                <Search size={16} />
                <input
                  placeholder="Sipariş, müşteri veya ürün ara"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Talep durumuna göre filtrele"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | 'all')}
              >
                <option value="all">Tüm durumlar</option>
                {(Object.keys(RETURN_STATUS) as ReturnStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {RETURN_STATUS[s]}
                  </option>
                ))}
              </select>
            </div>
            <p className={styles.count}>
              {filtered.length} / {entries.length} talep gösteriliyor · Son 200 kayıt
            </p>
            {filtered.length === 0 && (
              <div className={styles.empty}>
                <RotateCcw size={30} />
                <p>Henüz bu filtreye uygun iade/değişim talebi yok.</p>
              </div>
            )}
            <div className={styles.list}>
              {filtered.map((entry) => {
                const canRestock = Boolean(
                  entry.order?.inventory_deducted_at && !entry.order.inventory_restored_at,
                );
                return (
                  <article className={styles.card} key={entry.id}>
                    <div className={styles.cardHead}>
                      <div>
                        <strong>#{entry.order?.reference ?? 'Sipariş bulunamadı'}</strong>
                        <small>{returnDate(entry.created_at)}</small>
                      </div>
                      <span className={styles.status}>{RETURN_STATUS[entry.status]}</span>
                    </div>
                    <div className={styles.details}>
                      <div>
                        <small>Müşteri</small>
                        <strong>{entry.order?.customer_name ?? '—'}</strong>
                        <a href={`tel:${entry.order?.phone ?? ''}`}>{entry.order?.phone ?? ''}</a>
                      </div>
                      <div>
                        <small>Ürün / varyant</small>
                        <strong>{entry.item?.product_name ?? '—'}</strong>
                        <span>
                          {entry.item?.variant_label ?? 'Standart seçenek'} · {entry.quantity} adet
                        </span>
                      </div>
                      <div>
                        <small>Talep</small>
                        <strong>{RETURN_KIND[entry.request_type]}</strong>
                        <span>{RETURN_REASONS[entry.reason]}</span>
                      </div>
                    </div>
                    <p className={styles.customerNote}>
                      <b>Müşteri açıklaması:</b> {entry.customer_note}
                    </p>
                    {entry.admin_note && (
                      <p className={styles.adminNote}>
                        <b>Yönetici notu:</b> {entry.admin_note}
                      </p>
                    )}
                    {entry.order?.invoice_issued && (
                      <p className={styles.invoiceWarning}>
                        Bu siparişte resmî fatura kaydı var. İade/değişim muhasebe süreci ayrıca
                        kontrol edilmeli. <Link href="/admin/faturalar">Faturaları aç</Link>
                      </p>
                    )}
                    {entry.restocked_quantity > 0 && (
                      <p className={styles.restocked}>
                        <ClipboardCheck size={16} /> Fiziksel kontrolle {entry.restocked_quantity}{' '}
                        adet stok artırılmış.
                      </p>
                    )}
                    {entry.status !== 'closed' && entry.status !== 'rejected' && (
                      <div className={styles.actions}>
                        {entry.status === 'requested' && (
                          <>
                            <button
                              type="button"
                              className="button button-primary"
                              disabled={busy}
                              onClick={() => openForm(entry.id, 'approve')}
                            >
                              Talebi onayla
                            </button>
                            <button
                              type="button"
                              className="button button-outline"
                              disabled={busy}
                              onClick={() => openForm(entry.id, 'reject')}
                            >
                              Reddet
                            </button>
                          </>
                        )}
                        {entry.status === 'approved' && (
                          <button
                            type="button"
                            className="button button-primary"
                            disabled={busy}
                            onClick={() => openForm(entry.id, 'receive')}
                          >
                            Ürün teslim alındı
                          </button>
                        )}
                        {entry.status === 'received' && (
                          <button
                            type="button"
                            className="button button-primary"
                            disabled={busy}
                            onClick={() => openForm(entry.id, 'close')}
                          >
                            Fiziksel kontrol ve kapanış
                          </button>
                        )}
                      </div>
                    )}
                    {active === entry.id && (
                      <form
                        className={styles.actionForm}
                        onSubmit={(event) => void submit(event, entry)}
                      >
                        <h3>
                          {action === 'approve'
                            ? 'Talebi onayla'
                            : action === 'reject'
                              ? 'Talebi reddet'
                              : action === 'receive'
                                ? 'Ürün teslimini kaydet'
                                : 'Talebi sonuçlandır'}
                        </h3>
                        {action === 'close' && (
                          <>
                            <label>
                              Fiziksel ürün durumu
                              <select
                                value={condition}
                                onChange={(e) => {
                                  setCondition(e.target.value as Condition);
                                  setRestock(false);
                                }}
                              >
                                <option value="unknown">Değerlendirmede / belirsiz</option>
                                <option value="resellable">Satılabilir</option>
                                <option value="damaged">Hasarlı / satılamaz</option>
                              </select>
                            </label>
                            <label className={styles.checkLabel}>
                              <input
                                type="checkbox"
                                checked={restock}
                                disabled={condition !== 'resellable' || !canRestock}
                                onChange={(e) => setRestock(e.target.checked)}
                              />
                              <span>
                                Ürün fiziksel kontrol edildi; <strong>{entry.quantity} adet</strong>{' '}
                                stoğa ekle
                              </span>
                            </label>
                            {!canRestock && (
                              <p className={styles.warningSmall}>
                                Bu siparişte doğrulanmış stok düşüm kaydı yok veya stok daha önce
                                iade edilmiş. Otomatik stok eklenemez; gerekirse manuel envanter
                                mutabakatı yap.
                              </p>
                            )}
                            {entry.order?.invoice_issued && (
                              <label className={styles.checkLabel}>
                                <input
                                  type="checkbox"
                                  required
                                  checked={invoiceReviewed}
                                  onChange={(e) => setInvoiceReviewed(e.target.checked)}
                                />
                                <span>
                                  Muhasebeciyle resmî faturanın iade/düzeltme sürecini kontrol ettim
                                  (bu onay fatura iptali yapmaz).
                                </span>
                              </label>
                            )}
                            <p className={styles.warningSmall}>
                              Değişim ürünü gönderimi ve varsa gerçek ödeme iadesi manuel takip
                              edilir; bu ekran onları gerçekleştirmez.
                            </p>
                          </>
                        )}
                        {action === 'receive' && (
                          <p className={styles.warningSmall}>
                            Yalnızca ürün fiziksel olarak mağazaya ulaştıysa bu adımı onayla. Henüz
                            stok değişmez.
                          </p>
                        )}
                        <label>
                          Yönetici açıklaması{' '}
                          {action === 'reject' || action === 'close'
                            ? '(zorunlu)'
                            : '(isteğe bağlı)'}
                          <textarea
                            rows={3}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            required={action === 'reject' || action === 'close'}
                            minLength={action === 'reject' || action === 'close' ? 10 : undefined}
                            maxLength={1000}
                            placeholder="Müşteriye aktarılacak kararı ve gerekiyorsa muhasebe/teslimat notunu yaz."
                          />
                        </label>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className="button button-outline"
                            onClick={closeForm}
                          >
                            Vazgeç
                          </button>
                          <button className="button button-primary" type="submit" disabled={busy}>
                            {busy ? 'Kaydediliyor...' : 'İşlemi kaydet'}
                          </button>
                        </div>
                      </form>
                    )}
                    <details className={styles.timeline}>
                      <summary>İşlem geçmişi ({entry.history.length})</summary>
                      {entry.history.map((h) => (
                        <p key={h.id}>
                          <strong>{RETURN_STATUS[h.to_status]}</strong> · {returnDate(h.created_at)}
                          {h.note ? ` — ${h.note}` : ''}
                        </p>
                      ))}
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
