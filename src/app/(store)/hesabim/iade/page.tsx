import { customerPageNumber } from '@/lib/customer-pagination';
import type { CustomerPage } from '@/lib/customer-pagination';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { CustomerReturns } from '@/components/account/customer-returns';
import type { ReturnHistory, ReturnOrder, ReturnRequest } from '@/lib/returns';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'İade ve Değişim Taleplerim',
  robots: { index: false, follow: false },
};

export default async function CustomerReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect('/giris?next=%2Fhesabim%2Fiade');

  const { data, error } = await supabase.rpc('customer_return_page', {
    p_orders_page: customerPageNumber(params.ordersPage),
    p_requests_page: customerPageNumber(params.requestsPage),
  });
  const result = data as {
    orders: ReturnOrder[];
    requests: ReturnRequest[];
    history: ReturnHistory[];
    ordersMeta: CustomerPage;
    requestsMeta: CustomerPage;
  } | null;
  const emptyMeta = { page: 1, total: 0, pages: 1 };
  if (error) console.error('customer_return_page_failed', { code: error.code });

  return (
    <CustomerReturns
      orders={result?.orders ?? []}
      requests={result?.requests ?? []}
      history={result?.history ?? []}
      ordersMeta={result?.ordersMeta ?? emptyMeta}
      requestsMeta={result?.requestsMeta ?? emptyMeta}
      loadError={error ? 'İade bilgileri yüklenemedi. Lütfen tekrar deneyin.' : null}
    />
  );
}
