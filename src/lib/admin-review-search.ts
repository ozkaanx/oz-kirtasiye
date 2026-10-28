export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type AdminReview = {
  id: string;
  product_id: string;
  product_name: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  created_at: string;
};
export type ReviewSearch = { q: string; status: ReviewStatus | 'all'; page: number };
export type ReviewSearchResult = {
  rows: AdminReview[];
  total: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  stats: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
    average: number | null;
  };
};
export function parseReviewSearch(
  params: Record<string, string | string[] | undefined>,
): ReviewSearch {
  const single = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const page = single('page');
  return {
    q: single('q').trim().slice(0, 100),
    status: ['all', 'approved', 'rejected'].includes(single('status'))
      ? (single('status') as ReviewSearch['status'])
      : 'pending',
    page: /^[1-9]\d{0,6}$/.test(page) && Number(page) <= 1000000 ? Number(page) : 1,
  };
}
export function reviewSearchArgs(search: ReviewSearch) {
  return { p_query: search.q, p_status: search.status, p_page: search.page };
}
export function reviewSearchHref(search: ReviewSearch, page = 1) {
  const params = new URLSearchParams();
  if (search.q) params.set('q', search.q);
  if (search.status !== 'pending') params.set('status', search.status);
  if (page > 1) params.set('page', String(page));
  return '/admin/yorumlar' + (params.size ? '?' + params : '');
}
