import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminReturns } from '@/components/admin/admin-returns';
import {
  parseReturnSearch,
  returnSearchArgs,
  type ReturnSearchResult,
} from '@/lib/admin-return-search';
import { operationTrace } from '@/lib/operation-trace';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'İade ve Değişim Yönetimi',
  robots: { index: false, follow: false },
};
export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = parseReturnSearch(await searchParams);
  const trace = operationTrace('admin_return_search');
  let result: ReturnSearchResult | null = null;
  let loadError: string | null = null;
  try {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc('admin_search_returns', returnSearchArgs(search));
    if (error || !data || !Array.isArray(data.rows)) {
      trace.error(error ? 'database_error' : 'empty_result', error?.code);
      loadError = 'İade kayıtları yüklenemedi. Tekrar deneyin. Takip kodu: ' + trace.requestId;
    } else result = data as ReturnSearchResult;
  } catch {
    trace.error('unexpected');
    loadError = 'İade servisine ulaşılamadı. Takip kodu: ' + trace.requestId;
  }
  return (
    <AdminReturns
      key={JSON.stringify(search)}
      result={result}
      search={search}
      loadError={loadError}
    />
  );
}
