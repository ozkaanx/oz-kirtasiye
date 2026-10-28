import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminInvoices } from '@/components/admin/admin-invoices';
import {
  parseInvoiceSearch,
  invoiceSearchArgs,
  type InvoiceSearchResult,
} from '@/lib/admin-invoice-search';
import { operationTrace } from '@/lib/operation-trace';
export const metadata: Metadata = {
  title: 'Fatura Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = parseInvoiceSearch(await searchParams);
  const trace = operationTrace('admin_invoice_search');
  let result: InvoiceSearchResult | null = null;
  let loadError: string | null = null;
  try {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc('admin_search_invoices', invoiceSearchArgs(search));
    if (error || !data || !Array.isArray(data.rows)) {
      trace.error(error ? 'database_error' : 'empty_result', error?.code);
      loadError = 'Fatura kayıtları yüklenemedi. Tekrar deneyin. Takip kodu: ' + trace.requestId;
    } else result = data as InvoiceSearchResult;
  } catch {
    trace.error('unexpected');
    loadError = 'Fatura servisine ulaşılamadı. Takip kodu: ' + trace.requestId;
  }
  return (
    <AdminInvoices
      key={JSON.stringify(search)}
      result={result}
      search={search}
      loadError={loadError}
    />
  );
}
