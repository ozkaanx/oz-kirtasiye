export type InvoiceBilling = {
  buyer_type: 'individual' | 'corporate';
  recipient_name: string;
  company_name: string | null;
  tax_office: string | null;
  tax_number: string | null;
  city: string;
  district: string;
  address: string;
};
export type InvoiceRecord = {
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

export type InvoiceSearch = {
  q: string;
  status: 'all' | 'pending' | 'issued' | 'legacy';
  from: string;
  to: string;
  page: number;
};
export type InvoiceSearchResult = {
  rows: InvoiceOrder[];
  total: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  stats: { total: number; pending: number; issued: number; legacy: number };
};
function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : '';
}
export function parseInvoiceSearch(
  params: Record<string, string | string[] | undefined>,
): InvoiceSearch {
  const single = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const page = single('page');
  const from = date(single('from')),
    to = date(single('to'));
  return {
    q: single('q').trim().slice(0, 100),
    status: ['pending', 'issued', 'legacy'].includes(single('status'))
      ? (single('status') as InvoiceSearch['status'])
      : 'all',
    from,
    to: from && to && from > to ? from : to,
    page: /^[1-9]\d{0,6}$/.test(page) && Number(page) <= 1000000 ? Number(page) : 1,
  };
}
export function invoiceSearchArgs(search: InvoiceSearch) {
  return {
    p_query: search.q,
    p_status: search.status,
    p_from: search.from || null,
    p_to: search.to || null,
    p_page: search.page,
  };
}
export function invoiceSearchHref(search: InvoiceSearch, page = 1) {
  const p = new URLSearchParams();
  for (const key of ['q', 'status', 'from', 'to'] as const) {
    if (search[key] && search[key] !== 'all') p.set(key, search[key]);
  }
  if (page > 1) p.set('page', String(page));
  return '/admin/faturalar' + (p.size ? '?' + p : '');
}
