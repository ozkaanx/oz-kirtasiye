import type { StoreCategory } from './category-utils.ts';
export type CustomerOrdersResult = {
  rows: {
    id: string;
    reference: string;
    status: string;
    total: number;
    created_at: string;
    delivery_method: string;
  }[];
  latest: { customer_name: string; phone: string; created_at: string } | null;
  total: number;
  active: number;
  amount: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};
export type CategoryCatalog = {
  categories: StoreCategory[];
  productCounts: Record<string, number>;
};
export function isCustomerId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function customerPage(params: Record<string, string | string[] | undefined>) {
  const value = typeof params.page === 'string' ? params.page : '';
  return /^[1-9]\d{0,6}$/.test(value) && Number(value) <= 1000000 ? Number(value) : 1;
}
export function customerOrdersHref(id: string, page = 1) {
  return `/admin/musteriler/${encodeURIComponent(id)}` + (page > 1 ? `?page=${page}` : '');
}
