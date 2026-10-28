import type { CatalogFilters } from './catalog-filters';
import type { FilteredLiveProduct } from './catalog-filters';
import type { LiveProduct } from './real-catalog';

export const CATALOG_PAGE_SIZE = 24;

export type CatalogPageMatch = {
  product_id: string | null;
  variant_id: string | null;
  display_price: number | string | null;
  matched_stock: number | null;
  total_count: number | string;
};

export function parseCatalogPage(value: string | null): number {
  if (!value || !/^[1-9]\\d{0,5}$/.test(value)) return 1;
  return Math.min(Number(value), 100000);
}

/** Match the service-only catalog_search_page signature. Do not send browser prices. */
export function catalogPageArgs(filters: CatalogFilters, page: number) {
  return {
    p_category: filters.category,
    p_q: filters.q.trim(),
    p_sort: filters.sort,
    p_min: filters.min === '' ? null : Number(filters.min),
    p_max: filters.max === '' ? null : Number(filters.max),
    p_color: filters.color,
    p_size: filters.size,
    p_stock: filters.stock,
    p_campaign: filters.campaign,
    p_page: page,
    p_page_size: CATALOG_PAGE_SIZE,
  };
}

/** A SQL response includes total_count even when an offset has no matches. */
export function catalogPageMeta(rows: CatalogPageMatch[], requestedPage: number) {
  const rawTotal = Number(rows[0]?.total_count ?? 0);
  const total = Number.isSafeInteger(rawTotal) && rawTotal >= 0 ? rawTotal : 0;
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, requestedPage), pageCount);
  return { total, pageCount, currentPage };
}

/** Preserve SQL ordering and the precise variant selected by database filters. */
export function projectCatalogPage(
  matches: CatalogPageMatch[],
  products: LiveProduct[],
): FilteredLiveProduct[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const result: FilteredLiveProduct[] = [];
  for (const match of matches) {
    if (!match.product_id) continue;
    const product = byId.get(match.product_id);
    if (!product) continue; // Product may have been unpublished between the two reads.
    const variant = match.variant_id
      ? product.variants.find((item) => item.id === match.variant_id)
      : null;
    if (match.variant_id && !variant) continue; // Variant was unpublished after the search.
    const stock = match.matched_stock === null
      ? product.stock_quantity
      : Number(match.matched_stock);
    if (variant) {
      result.push({
        ...product,
        filterVariantId: variant.id,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        stock_quantity: stock,
        promotion: variant.promotion,
        campaignNotice: variant.campaignNotice,
        imageUrl: variant.imageUrl ?? product.galleryUrls[0] ?? product.imageUrl,
      });
    } else {
      result.push({ ...product, stock_quantity: stock });
    }
  }
  return result;
}
