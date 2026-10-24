import Link from 'next/link';
import { FileClock, FileCheck2, FileWarning, ArrowUpRight } from 'lucide-react';
import css from './order-invoice-card.module.css';

export type OrderInvoiceBilling = {
  buyer_type: 'individual' | 'corporate';
  recipient_name: string;
  company_name: string | null;
  tax_office: string | null;
  tax_number: string | null;
  city: string;
  district: string;
  address: string;
};

export type OrderInvoiceRecord = {
  status: 'pending' | 'issued';
  document_type: 'e_arsiv' | 'e_fatura' | null;
  invoice_number: string | null;
  issue_date: string | null;
  provider: string | null;
};

type Props = {
  billing: OrderInvoiceBilling | null | undefined;
  invoice: OrderInvoiceRecord | null | undefined;
  paymentStatus: string;
  orderStatus: string;
};

export function OrderInvoiceCard({ billing, invoice, paymentStatus, orderStatus }: Props) {
  const issued = invoice?.status === 'issued' && !!invoice.invoice_number;
  const legacy = !billing || !invoice;
  const cancelled = orderStatus === 'cancelled';
  const title = legacy
    ? 'Fatura bilgileri eksik'
    : issued
      ? 'Resmî fatura bilgisi kayıtlı'
      : cancelled
        ? 'İptal edildi · fatura oluşturulmadı'
        : 'Fatura kaydı bekliyor';
  const Icon = legacy ? FileWarning : issued ? FileCheck2 : FileClock;

  return (
    <section className={css.card} aria-label="Bu siparişin fatura bilgileri">
      <div className={css.heading}>
        <div className={css.title}>
          <Icon size={19} aria-hidden="true" />
          <h3>Fatura bilgileri</h3>
        </div>
        <span className={css.status} data-kind={legacy ? 'legacy' : issued ? 'issued' : 'pending'}>
          {title}
        </span>
      </div>
      <div className={css.grid}>
        <div className={css.detail}>
          <span className={css.label}>Fatura alıcısı</span>
          <strong>
            {billing?.buyer_type === 'corporate'
              ? billing.company_name
              : billing?.recipient_name || 'Eski sipariş · bilgi yok'}
          </strong>
          {billing?.buyer_type === 'corporate' && (
            <small>
              VKN: {billing.tax_number || '—'} ·{' '}
              {billing.tax_office || 'Vergi dairesi belirtilmedi'}
            </small>
          )}
          {billing && (
            <small>
              {billing.district} / {billing.city}
            </small>
          )}
        </div>
        <div className={css.detail}>
          <span className={css.label}>Resmî belge durumu</span>
          <strong>{issued ? invoice.invoice_number : 'Henüz kayıtlı fatura numarası yok'}</strong>
          {issued && (
            <small>
              {invoice.document_type === 'e_fatura' ? 'e-Fatura' : 'e-Arşiv Fatura'}
              {invoice.issue_date ? ` · ${invoice.issue_date}` : ''}
              {invoice.provider ? ` · ${invoice.provider}` : ''}
            </small>
          )}
          {!issued && (
            <small>
              {paymentStatus === 'not_collected'
                ? 'Ödeme tahsil edilmedi.'
                : 'Ödeme durumunu kontrol edin.'}{' '}
              Fatura kesilmiş sayılmaz.
            </small>
          )}
          {legacy && <small>Fatura bilgileri önceki sürümde alınmamış olabilir.</small>}
        </div>
      </div>
      <Link className={css.link} href="/admin/faturalar">
        Fatura yönetimine git <ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}
