import type { AdminReturnRequest, ReturnStatus, ReturnKind } from './returns.ts';
export type ReturnSearch = {
  q: string;
  status: ReturnStatus | 'all';
  kind: ReturnKind | 'all';
  page: number;
};
export type ReturnSearchResult = {
  rows: AdminReturnRequest[];
  total: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  stats: Record<ReturnStatus | 'total', number>;
};
export function parseReturnSearch(
  params: Record<string, string | string[] | undefined>,
): ReturnSearch {
  const single = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const page = single('page');
  return {
    q: single('q').trim().slice(0, 100),
    status: ['requested', 'approved', 'rejected', 'received', 'closed'].includes(single('status'))
      ? (single('status') as ReturnSearch['status'])
      : 'all',
    kind: ['return', 'exchange'].includes(single('kind'))
      ? (single('kind') as ReturnSearch['kind'])
      : 'all',
    page: /^[1-9]\d{0,6}$/.test(page) && Number(page) <= 1000000 ? Number(page) : 1,
  };
}
export function returnSearchArgs(search: ReturnSearch) {
  return { p_query: search.q, p_status: search.status, p_kind: search.kind, p_page: search.page };
}
export function returnSearchHref(search: ReturnSearch, page = 1) {
  const p = new URLSearchParams();
  for (const key of ['q', 'status', 'kind'] as const) {
    if (search[key] && search[key] !== 'all') p.set(key, search[key]);
  }
  if (page > 1) p.set('page', String(page));
  return '/admin/iadeler' + (p.size ? '?' + p : '');
}
