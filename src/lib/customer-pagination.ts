export const CUSTOMER_PAGE_SIZE = 20;
export type CustomerPage = { page: number; total: number; pages: number };
export function customerPageNumber(value: string | string[] | undefined): number {
  return typeof value === 'string' && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}
export function customerPageMeta(total: number, requested: number): CustomerPage {
  const pages = Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE));
  return { total, pages, page: Math.min(Math.max(1, requested), pages) };
}
export function customerPageHref(
  path: string,
  params: Record<string, string>,
  key: string,
  page: number,
) {
  const query = new URLSearchParams(params);
  if (page > 1) query.set(key, String(page));
  else query.delete(key);
  return path + (query.size ? '?' + query : '');
}
