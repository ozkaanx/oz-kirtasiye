import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminReports } from '@/components/admin/admin-reports';

export const metadata: Metadata = { title: 'Sipariş Raporları', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type RequestRow = { id: string; created_at: string; status: string; total: number | string };
type ItemRow = { order_request_id: string; product_name: string; quantity: number };
const LIMIT = 500;
const MAX_RECORDS = 20000;

async function loadPages<T>(
  fetchPage: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_RECORDS; offset += LIMIT) {
    const { data, error } = await fetchPage(offset, offset + LIMIT - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < LIMIT) return rows;
  }
  throw new Error('Rapor 20.000 kayıt sınırına ulaştı. Eksik sonuç göstermemek için rapor durduruldu.');
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const raw = (await searchParams).period;
  const period = raw === '7' || raw === '90' || raw === '365' ? Number(raw) : 30;
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (period - 1));
  from.setUTCHours(0, 0, 0, 0);
  const supabase = await createServerSupabase();
  let loadError: string | null = null;
  let requests: RequestRow[] = [];
  let items: ItemRow[] = [];
  try {
    requests = await loadPages<RequestRow>((start, end) => supabase.from('order_requests')
      .select('id,created_at,status,total').gte('created_at', from.toISOString())
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, end));
    if (requests.length) {
      // Fetch only order items belonging to the selected period, in bounded batches.
      for (let i = 0; i < requests.length; i += 100) {
        const ids = requests.slice(i, i + 100).map((row) => row.id);
        const batch = await loadPages<ItemRow>((start, end) => supabase.from('order_request_items')
          .select('order_request_id,product_name,quantity').in('order_request_id', ids)
          .order('order_request_id').range(start, end));
        items.push(...batch);
      }
    }
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : 'Raporlar yüklenemedi.';
    requests = [];
    items = [];
  }
  const counts = new Map<string, number>();
  const amounts = new Map<string, number>();
  const statuses = new Map<string, number>();
  const acceptedIds = new Set<string>();
  for (const order of requests) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(order.created_at));
    counts.set(date, (counts.get(date) ?? 0) + 1);
    statuses.set(order.status, (statuses.get(order.status) ?? 0) + 1);
    if (order.status !== 'cancelled') {
      acceptedIds.add(order.id);
      amounts.set(date, (amounts.get(date) ?? 0) + Number(order.total));
    }
  }
  const byProduct = new Map<string, number>();
  for (const row of items) {
    if (!acceptedIds.has(row.order_request_id)) continue;
    byProduct.set(row.product_name, (byProduct.get(row.product_name) ?? 0) + Number(row.quantity));
  }
  const days = Array.from({ length: period }, (_, i) => {
    const date = new Date(from);
    date.setUTCDate(from.getUTCDate() + i);
    const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    return { date: label, count: counts.get(label) ?? 0, amount: amounts.get(label) ?? 0 };
  });
  const noncancelled = requests.filter((r) => r.status !== 'cancelled');
  return <AdminReports period={period} error={loadError} data={{
    count: requests.length,
    activeCount: noncancelled.length,
    nominalTotal: noncancelled.reduce((sum, r) => sum + Number(r.total), 0),
    average: noncancelled.length ? noncancelled.reduce((sum, r) => sum + Number(r.total), 0) / noncancelled.length : 0,
    days,
    statuses: [...statuses.entries()].map(([status, count]) => ({ status, count })),
    products: [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, quantity]) => ({ name, quantity })),
  }} />;
}
