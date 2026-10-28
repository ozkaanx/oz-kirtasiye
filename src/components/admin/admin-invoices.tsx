'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  invoiceSearchHref,
  type InvoiceOrder,
  type InvoiceSearch,
  type InvoiceSearchResult,
} from '@/lib/admin-invoice-search';
import filterStyles from './admin-list-filters.module.css';

import { useRouter } from 'next/navigation';
import { FileCheck2, FileClock, FileWarning, Info } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

import { formatPrice } from '@/lib/format';
import css from './admin-invoices.module.css';

function prettyDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
  });
}
const documentNames = { e_arsiv: 'e-Arşiv Fatura', e_fatura: 'e-Fatura' } as const;

export function AdminInvoices({
  result,
  search,
  loadError,
}: {
  result: InvoiceSearchResult | null;
  search: InvoiceSearch;
  loadError: string | null;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [refreshing, startTransition] = useTransition();
  const orders = result?.rows ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<'e_arsiv' | 'e_fatura'>('e_arsiv');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function saveInvoice(order: InvoiceOrder) {
    if (lock.current || refreshing) return;
    if (
      !window.confirm(
        `Faturayı GİB/entegratör sisteminde gerçekten düzenledin mi? ${order.reference} için yalnızca resmî belge kaydını oluşturacağız.`,
      )
    )
      return;
    lock.current = true;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const { error: rpcError } = await createBrowserSupabase().rpc('admin_record_issued_invoice', {
        p_order_id: order.id,
        p_document_type: documentType,
        p_invoice_number: invoiceNumber.trim().toUpperCase(),
        p_issue_date: issueDate,
        p_provider: provider.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSuccess(`${order.reference}: Resmî fatura bilgileri kaydedildi.`);
      setExpanded(null);
      setInvoiceNumber('');
      setIssueDate('');
      setProvider('');
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fatura kaydı oluşturulamadı.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="admin-body">
      <div className="admin-page-heading">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE · BELGELER</span>
          <h1>
            Fatura yönetimi<span className="orange-dot">.</span>
          </h1>
          <p>
            Müşterinin fatura bilgilerini kontrol et, resmî faturanın kesilme durumunu takip et.
          </p>
        </div>
      </div>
      <div className={css.notice}>
        <Info size={18} />
        <span>
          <strong>Bu ekran fatura kesmez.</strong> Önce GİB portalında veya çalıştığın e-belge
          entegratöründe resmî faturayı düzenle. Sonrasında belge numarasını ve tarihini burada
          kaydet. Ödeme alınmamış sipariş talepleri otomatik olarak faturalandırılmaz.
        </span>
      </div>
      <div className={css.summary}>
        <div className={css.stat}>
          <strong>{result?.stats.pending ?? '—'}</strong>
          <span>
            <FileClock size={14} /> Fatura kaydı bekleyen
          </span>
        </div>
        <div className={css.stat}>
          <strong>{result?.stats.issued ?? '—'}</strong>
          <span>
            <FileCheck2 size={14} /> Belge numarası kaydedilen
          </span>
        </div>
        <div className={css.stat}>
          <strong>{result?.stats.legacy ?? '—'}</strong>
          <span>
            <FileWarning size={14} /> Eski sipariş / fatura bilgisi eksik
          </span>
        </div>
      </div>
      {loadError && (
        <p className={css.error} role="alert">
          Kayıtlar yüklenemedi: {loadError}
        </p>
      )}
      {error && (
        <p className={css.error} role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className={css.success} role="status">
          {success}
        </p>
      )}
      <form
        action="/admin/faturalar"
        method="get"
        key={JSON.stringify(search)}
        className={filterStyles.filters}
      >
        <label className={filterStyles.field}>
          Sipariş, müşteri veya fatura ara
          <input
            name="q"
            maxLength={100}
            defaultValue={search.q}
            placeholder="Sipariş no, müşteri, firma veya fatura no"
          />
        </label>
        <label className={filterStyles.field}>
          Fatura durumu
          <select name="status" defaultValue={search.status}>
            <option value="all">Tüm faturalar</option>
            <option value="pending">Kayıt bekleyen</option>
            <option value="issued">Kesilmiş belge kaydı</option>
            <option value="legacy">Eski / eksik kayıt</option>
          </select>
        </label>
        <label className={filterStyles.field}>
          Sipariş başlangıç tarihi
          <input name="from" type="date" defaultValue={search.from} />
        </label>
        <label className={filterStyles.field}>
          Sipariş bitiş tarihi
          <input name="to" type="date" defaultValue={search.to} />
        </label>
        <button type="submit" className={filterStyles.reset}>
          Ara / Filtrele
        </button>
        <Link href="/admin/faturalar" className={filterStyles.reset}>
          Filtreleri temizle
        </Link>
      </form>
      <p className={css.muted}>
        Özetler tüm siparişleri kapsar.{' '}
        {result
          ? `${orders.length} / ${result.total} kayıt · Sayfa ${result.page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))}`
          : 'Fatura listesi yüklenemedi.'}
      </p>
      <div className={css.stack}>
        {result && orders.length === 0 && (
          <p className={css.muted}>Bu filtrede sipariş bulunamadı.</p>
        )}
        {orders.map((order) => {
          const canMark =
            order.invoice?.status === 'pending' &&
            order.status !== 'cancelled' &&
            order.status !== 'new';
          return (
            <article className={css.card} key={order.id}>
              <div className={css.head}>
                <div>
                  <strong>{order.reference}</strong>
                  <span className={css.meta}>
                    {prettyDate(order.created_at)} · {order.customer_name} · Sipariş:{' '}
                    {formatPrice(order.total)}
                    {order.discount_amount > 0 &&
                      ` · Kupon: ${order.coupon_code} (−${formatPrice(order.discount_amount)})`}
                  </span>
                </div>
                <span
                  className={css.tag}
                  data-status={!order.billing ? 'legacy' : (order.invoice?.status ?? 'legacy')}
                >
                  {!order.billing
                    ? 'Eski · fatura bilgisi eksik'
                    : order.invoice?.status === 'issued'
                      ? 'Fatura bilgileri kaydedildi'
                      : 'Fatura kaydı bekliyor'}
                </span>
              </div>
              <div className={css.info}>
                <div>
                  <small>Fatura alıcısı</small>
                  <strong>
                    {order.billing?.buyer_type === 'corporate'
                      ? order.billing.company_name
                      : (order.billing?.recipient_name ?? 'Önceki sürümde alınmamış')}
                  </strong>
                  {order.billing?.buyer_type === 'corporate' && (
                    <p>
                      VKN: {order.billing.tax_number} · Vergi dairesi: {order.billing.tax_office}
                    </p>
                  )}
                  {order.billing && (
                    <p>
                      {order.billing.address}, {order.billing.district} / {order.billing.city}
                    </p>
                  )}
                </div>
                <div>
                  <small>Belge / sipariş durumu</small>
                  <strong>
                    {order.invoice?.invoice_number ?? 'Resmî fatura numarası kayıtlı değil'}
                  </strong>
                  {order.invoice?.document_type && (
                    <p>
                      {documentNames[order.invoice.document_type]} · {order.invoice.issue_date}
                    </p>
                  )}
                  <p>
                    Sipariş: {order.status} · Ödeme:{' '}
                    {order.payment_status === 'not_collected'
                      ? 'Tahsil edilmedi'
                      : order.payment_status}
                  </p>
                  {order.invoice?.provider && <p>Fatura sistemi: {order.invoice.provider}</p>}
                </div>
              </div>
              {!order.billing && (
                <p className={css.muted}>
                  Bu sipariş fatura bilgileri eklenmeden önce oluşturuldu. Alıcı bilgileri
                  doğrulanmadan fatura kaydı eklenemez.
                </p>
              )}
              {canMark && (
                <div className={css.actions}>
                  <button
                    type="button"
                    className={css.toggle}
                    disabled={busy || refreshing}
                    onClick={() => {
                      setExpanded(expanded === order.id ? null : order.id);
                      setError('');
                      setSuccess('');
                      setInvoiceNumber('');
                      setIssueDate('');
                      setProvider('');
                    }}
                  >
                    {expanded === order.id ? 'Formu kapat' : 'Kesilmiş faturayı kaydet'}
                  </button>
                  {expanded === order.id && (
                    <form
                      className={css.form}
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveInvoice(order);
                      }}
                    >
                      <label className={css.field}>
                        Resmî belge türü
                        <select
                          value={documentType}
                          onChange={(e) => setDocumentType(e.target.value as typeof documentType)}
                        >
                          <option value="e_arsiv">e-Arşiv Fatura</option>
                          <option value="e_fatura">e-Fatura</option>
                        </select>
                      </label>
                      <label className={css.field}>
                        Fatura düzenleme tarihi
                        <input
                          required
                          type="date"
                          value={issueDate}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setIssueDate(e.target.value)}
                        />
                      </label>
                      <label className={css.field}>
                        GİB / entegratör fatura numarası
                        <input
                          required
                          minLength={16}
                          maxLength={16}
                          pattern="[A-Za-z0-9]{16}"
                          autoCapitalize="characters"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
                          placeholder="ABC2026000000001"
                        />
                      </label>
                      <label className={css.field}>
                        Kullandığın sistem (isteğe bağlı)
                        <input
                          maxLength={120}
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          placeholder="GİB Portal / entegratör adı"
                        />
                      </label>
                      <p className={`${css.muted} ${css.full}`}>
                        Bu işlem faturayı GİB&apos;e göndermez. Yalnızca dış sistemde düzenlenmiş
                        belgenin referansını saklar; hata varsa muhasebeciyle düzeltme yapılmalıdır.
                      </p>
                      <div className={css.foot}>
                        <button
                          className={css.toggle}
                          type="button"
                          disabled={busy || refreshing}
                          onClick={() => setExpanded(null)}
                        >
                          Vazgeç
                        </button>
                        <button className={css.btn} type="submit" disabled={busy || refreshing}>
                          {busy ? 'Kaydediliyor...' : 'Resmî belge kaydını oluştur'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {result && (result.hasPrevious || result.hasNext) && (
        <nav className={filterStyles.filters} aria-label="Fatura sayfaları">
          {result.hasPrevious && (
            <Link className={filterStyles.reset} href={invoiceSearchHref(search, result.page - 1)}>
              Önceki sayfa
            </Link>
          )}
          {result.hasNext && (
            <Link className={filterStyles.reset} href={invoiceSearchHref(search, result.page + 1)}>
              Sonraki sayfa
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
