import { catalogFacets, filterCatalogProducts, type CatalogFilters } from '@/lib/catalog-filters';
import type { StoreCategory } from '@/lib/category-utils';
import { getAllCatalogProducts } from '@/lib/real-catalog';

export const CATALOG_PAGE_SIZE = 24;

export function parseCatalogPage(value: string | null): number {
  if (!value || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Math.min(Number(value), 100000);
}

export async function getPagedCatalog(filters: CatalogFilters, page: number, categories: StoreCategory[]) {
  const products = await getAllCatalogProducts();
  const facets = catalogFacets(products, categories, filters.category);
  const filtered = filterCatalogProducts(products, categories, filters);
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * CATALOG_PAGE_SIZE;
  return {
    products: filtered.slice(start, start + CATALOG_PAGE_SIZE),
    total,
    pageCount,
    currentPage,
    facets,
  };
}
