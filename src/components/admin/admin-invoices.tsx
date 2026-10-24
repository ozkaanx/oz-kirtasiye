'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileCheck2, FileClock, FileWarning, Info, LogOut, Search } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { formatPrice } from '@/lib/format';
import css from './admin-invoices.module.css';

type InvoiceBilling = {
  buyer_type: 'individual' | 'corporate';
  recipient_name: string;
  company_name: string | null;
  tax_office: string | null;
  tax_number: string | null;
  city: string;
  district: string;
  address: string;
};
type InvoiceRecord = {
  status: 'pending' | 'issued';
  document_type: 'e_arsiv' | 'e_fatura' | null;
  invoice_number: string | null;
  issue_date: string | null;
  provider: string | null;
  recorded_at: string | null;
};
export type InvoiceOrder = {
  id: string;
  reference: string;
  created_at: string;
  customer_name: string;
  phone: string;
  status: string;
  payment_status: string;
  delivery_method: string;
  total: number;
  discount_amount: number;
  coupon_code: string | null;
  billing: InvoiceBilling | null;
  invoice: InvoiceRecord | null;
};

function prettyDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
  });
}
const documentNames = { e_arsiv: 'e-Arşiv Fatura', e_fatura: 'e-Fatura' } as const;

export function AdminInvoices({
  orders,
  loadError,
}: {
  orders: InvoiceOrder[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'issued' | 'legacy'>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<'e_arsiv' | 'e_fatura'>('e_arsiv');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = orders.filter((o) => o.invoice?.status === 'pending').length;
  const issued = orders.filter((o) => o.invoice?.status === 'issued').length;
  const legacy = orders.filter((o) => !o.billing).length;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr-TR');
    return orders.filter((order) => {
      if (filter === 'legacy' && order.billing) return false;
      if (filter === 'pending' && order.invoice?.status !== 'pending') return false;
      if (filter === 'issued' && order.invoice?.status !== 'issued') return false;
      if (
        term &&
        !`${order.reference} ${order.customer_name} ${order.billing?.company_name ?? ''} ${order.invoice?.invoice_number ?? ''}`
          .toLocaleLowerCase('tr-TR')
          .includes(term)
      )
        return false;
      return true;
    });
  }, [orders, query, filter]);

  async function saveInvoice(order: InvoiceOrder) {
    if (busy) return;
    if (
      !window.confirm(
        `Faturayı GİB/entegratör sisteminde gerçekten düzenledin mi? ${order.reference} için yalnızca resmî belge kaydını oluşturacağız.`,
      )
    )
      return;
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
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fatura kaydı oluşturulamadı.');
    } finally {
      setBusy(false);
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
      <main className="admin-main">
        <header className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button type="button" className="admin-logout" onClick={() => void logout()}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </header>
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
              <strong>{pending}</strong>
              <span>
                <FileClock size={14} /> Fatura kaydı bekleyen
              </span>
            </div>
            <div className={css.stat}>
              <strong>{issued}</strong>
              <span>
                <FileCheck2 size={14} /> Belge numarası kaydedilen
              </span>
            </div>
            <div className={css.stat}>
              <strong>{legacy}</strong>
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
          <div className={css.tools}>
            <input
              aria-label="Sipariş veya fatura ara"
              placeholder="Sipariş no, müşteri, firma veya fatura no..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Fatura filtresi"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">Tüm faturalar</option>
              <option value="pending">Kayıt bekleyen</option>
              <option value="issued">Kesilmiş belge kaydı</option>
              <option value="legacy">Eski / eksik kayıt</option>
            </select>
          </div>
          <p className={css.muted}>
            {filtered.length} kayıt gösteriliyor (son {orders.length} sipariş içinden).
          </p>
          <div className={css.stack}>
            {filtered.length === 0 && <p className={css.muted}>Bu filtrede sipariş bulunamadı.</p>}
            {filtered.map((order) => {
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
                          VKN: {order.billing.tax_number} · Vergi dairesi:{' '}
                          {order.billing.tax_office}
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
                              onChange={(e) =>
                                setDocumentType(e.target.value as typeof documentType)
                              }
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
                            Bu işlem faturayı GİB'e göndermez. Yalnızca dış sistemde düzenlenmiş
                            belgenin referansını saklar; hata varsa muhasebeciyle düzeltme
                            yapılmalıdır.
                          </p>
                          <div className={css.foot}>
                            <button
                              className={css.toggle}
                              type="button"
                              onClick={() => setExpanded(null)}
                            >
                              Vazgeç
                            </button>
                            <button className={css.btn} type="submit" disabled={busy}>
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
        </div>
      </main>
    </div>
  );
}
