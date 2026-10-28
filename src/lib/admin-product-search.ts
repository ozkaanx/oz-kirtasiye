export type ProductSearch = {
  q: string;
  category: string;
  visibility: string;
  stock: string;
  sort: string;
  page: number;
};
export type ProductSearchMeta = {
  total: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  stats: { total: number; stock: number; low: number; out: number };
};
export function parseProductSearch(
  params: Record<string, string | string[] | undefined>,
): ProductSearch {
  const single = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const page = single('page');
  const category = single('category');
  return {
    q: single('q').trim().slice(0, 100),
    category: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category)
      ? category
      : 'all',
    visibility: ['active', 'inactive'].includes(single('visibility'))
      ? single('visibility')
      : 'all',
    stock: ['available', 'low', 'out'].includes(single('stock')) ? single('stock') : 'all',
    sort: ['priceAsc', 'priceDesc', 'stockAsc', 'stockDesc'].includes(single('sort'))
      ? single('sort')
      : 'name',
    page: /^[1-9]\d{0,6}$/.test(page) && Number(page) <= 1000000 ? Number(page) : 1,
  };
}
export function productSearchArgs(search: ProductSearch) {
  return {
    p_query: search.q,
    p_category: search.category === 'all' ? null : search.category,
    p_visibility: search.visibility,
    p_stock: search.stock,
    p_sort: search.sort,
    p_page: search.page,
  };
}
export function productSearchHref(search: ProductSearch, page: number) {
  const params = new URLSearchParams();
  for (const key of ['q', 'category', 'visibility', 'stock', 'sort'] as const) {
    if (search[key] && search[key] !== 'all' && !(key === 'sort' && search[key] === 'name'))
      params.set(key, search[key]);
  }
  if (page > 1) params.set('page', String(page));
  return '/admin/urunler' + (params.size ? '?' + params : '');
}
