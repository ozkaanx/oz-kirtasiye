/**
 * admin_search_products returns an effective stock quantity for active variants.
 * Never filter an arbitrary first 50 products by their raw stock quantity:
 * that approach misses products whose variant stock is empty or low.
 */
export type CriticalStockProduct = {
  id: string;
  name: string;
  slug: string;
  stock: number;
  threshold: number;
};

type SearchResult = { rows: unknown };

function readResults(data: unknown): CriticalStockProduct[] | null {
  if (!data || typeof data !== 'object' || !('rows' in data)) return null;
  const rows = (data as SearchResult).rows;
  if (!Array.isArray(rows)) return null;

  const products: CriticalStockProduct[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') return null;
    const value = row as Record<string, unknown>;
    const stock = value.stock_quantity;
    const threshold = value.low_stock_threshold;
    if (
      typeof value.id !== 'string' ||
      typeof value.name !== 'string' ||
      typeof value.slug !== 'string' ||
      typeof stock !== 'number' ||
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      typeof threshold !== 'number' ||
      !Number.isSafeInteger(threshold) ||
      threshold < 0
    ) return null;
    products.push({
      id: value.id,
      name: value.name,
      slug: value.slug,
      stock,
      threshold,
    });
  }
  return products;
}

/**
 * Requests are already filtered by the RPC using effective variant stock.
 * The two lists have disjoint states and both use stockAsc order. Always show
 * out-of-stock first, then critically low, with no misleading fallback.
 */
export function selectCriticalStockProducts(
  outOfStockResult: unknown,
  lowStockResult: unknown,
  limit = 6,
): CriticalStockProduct[] | null {
  const out = readResults(outOfStockResult);
  const low = readResults(lowStockResult);
  if (out === null || low === null) return null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  if (out.some((item) => item.stock !== 0)) return null;
  if (low.some((item) => item.stock === 0 || item.stock > item.threshold)) return null;

  return [...out, ...low].slice(0, limit);
}
