import type { AdminOrderRequest } from './admin-orders.ts';

export type OrderSearch = {
  q: string;
  status: string;
  delivery: string;
  from: string;
  to: string;
  after: string;
  before: string;
};
export type OrderSearchResult = {
  rows: AdminOrderRequest[];
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  stats: { total: number; new: number; processing: number; shipped: number };
};
const statuses = [
  'new',
  'contacted',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
];
function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : '';
}
// Keep PostgreSQL microseconds intact: converting cursors through Date can skip equal-time rows.
export function parseOrderCursor(value: string) {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      value,
    );
  return match && date(match[1].slice(0, 10)) && Number.isFinite(Date.parse(match[1]))
    ? { time: match[1], id: match[2] }
    : null;
}
export function orderCursor(order: Pick<AdminOrderRequest, 'created_at' | 'id'>) {
  return `${order.created_at}|${order.id}`;
}
export function parseOrderSearch(
  params: Record<string, string | string[] | undefined>,
): OrderSearch {
  const single = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const from = date(single('from'));
  const to = date(single('to'));
  const after = single('after');
  const before = single('before');
  return {
    q: single('q').trim().slice(0, 100),
    status: statuses.includes(single('status')) ? single('status') : 'all',
    delivery: ['shipping', 'pickup', 'legacy'].includes(single('delivery'))
      ? single('delivery')
      : 'all',
    from,
    to: from && to && from > to ? from : to,
    after: parseOrderCursor(after) ? after : '',
    before: !parseOrderCursor(after) && parseOrderCursor(before) ? before : '',
  };
}
export function orderSearchHref(
  search: OrderSearch,
  cursor?: { direction: 'after' | 'before'; value: string },
) {
  const params = new URLSearchParams();
  for (const key of ['q', 'status', 'delivery', 'from', 'to'] as const) {
    if (search[key] && search[key] !== 'all') params.set(key, search[key]);
  }
  if (cursor) params.set(cursor.direction, cursor.value);
  return `/admin/siparisler${params.size ? `?${params}` : ''}`;
}
export function orderSearchArgs(search: OrderSearch) {
  const cursor = parseOrderCursor(search.after || search.before);
  return {
    p_query: search.q,
    p_status: search.status === 'all' ? null : search.status,
    p_delivery: search.delivery === 'all' ? null : search.delivery,
    p_from: search.from || null,
    p_to: search.to || null,
    p_cursor_time: cursor?.time ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_direction: search.before ? 'before' : 'after',
    p_limit: 25,
  };
}
