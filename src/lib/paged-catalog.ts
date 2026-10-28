import type { CatalogFilters } from '@/lib/catalog-filters';
import {
  catalogPageArgs,
  catalogPageMeta,
  CATALOG_PAGE_SIZE,
  projectCatalogPage,
  type CatalogPageMatch,
} from '@/lib/catalog-page-helpers';
import { PRODUCT_FIELDS, transformRows, type ProductRow } from '@/lib/real-catalog';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createOrderServerClient } from '@/lib/supabase/order-server';
import { createServerSupabase } from '@/lib/supabase/server';

export { parseCatalogPage } from '@/lib/catalog-page-helpers';
export { CATALOG_PAGE_SIZE } from '@/lib/catalog-page-helpers';

type FacetRow = { colors: string[] | null; sizes: string[] | null };

export async function getPagedCatalog(filters: CatalogFilters, requestedPage: number) {
  const empty = {
    products: [],
    total: 0,
    pageCount: 1,
    currentPage: 1,
    facets: { colors: [] as string[], sizes: [] as string[] },
  };
  if (!hasSupabaseConfig()) return empty;

  // Both RPCs are service-role-only; filter/discount internals never enter the browser.
  const service = createOrderServerClient();
  const readPage = (page: number) =>
    service.rpc('catalog_search_page', catalogPageArgs(filters, page));

  // Invalid price URLs used to show no products instead of an error page.
  const minimum = filters.min === '' ? null : Number(filters.min);
  const maximum = filters.max === '' ? null : Number(filters.max);
  const invalidPriceRange = minimum !== null && maximum !== null && minimum > maximum;
  const [firstPage, facetResponse] = await Promise.all([
    invalidPriceRange ? Promise.resolve(null) : readPage(requestedPage),
    service.rpc('catalog_category_facets', { p_category: filters.category }),
  ]);
  if (firstPage?.error || facetResponse.error) {
    console.error('Katalog sorgusu başarısız:', firstPage?.error?.code ?? facetResponse.error?.code);
    throw new Error('Ürünler şu anda yüklenemiyor.');
  }

  const facet = ((facetResponse.data ?? []) as FacetRow[])[0];
  const facets = { colors: facet?.colors ?? [], sizes: facet?.sizes ?? [] };
  if (invalidPriceRange) return { ...empty, facets };

  const firstMatches = (firstPage?.data ?? []) as CatalogPageMatch[];
  const { total, pageCount, currentPage } = catalogPageMeta(firstMatches, requestedPage);
  const response = currentPage === requestedPage ? firstPage! : await readPage(currentPage);
  if (response.error) {
    console.error('Katalog sayfası okunamadı:', response.error.code);
    throw new Error('Ürünler şu anda yüklenemiyor.');
  }
  const matches = (response.data ?? []) as CatalogPageMatch[];
  const ids = matches
    .map((item) => item.product_id)
    .filter((id): id is string => id !== null);
  if (!ids.length) return { ...empty, total, pageCount, currentPage, facets };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .in('id', ids)
    .limit(CATALOG_PAGE_SIZE);
  if (error) {
    console.error('Katalog ürün detayları okunamadı:', error.code);
    throw new Error('Ürünler şu anda yüklenemiyor.');
  }
  const loaded = await transformRows((data ?? []) as ProductRow[]);
  return {
    products: projectCatalogPage(matches, loaded),
    total,
    pageCount,
    currentPage,
    facets,
  };
}
