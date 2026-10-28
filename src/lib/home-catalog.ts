import 'server-only';

import { DEFAULT_CATALOG_FILTERS } from '@/lib/catalog-filters';
import { catalogPageArgs, type CatalogPageMatch } from '@/lib/catalog-page-helpers';
import {
  homeCatalogProductIds,
  homeCatalogQueries,
  projectHomeCatalog,
} from '@/lib/home-catalog-helpers';
import { PRODUCT_FIELDS, transformRows, type ProductRow } from '@/lib/real-catalog';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createOrderServerClient } from '@/lib/supabase/order-server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { StoreCategory } from '@/lib/category-utils';

/**
 * Load only 8 featured items for each of the six visible categories, plus
 * four newest products. Product details and promotions are fetched only once
 * for the resulting unique IDs, irrespective of the total catalogue size.
 */
export async function getHomeCatalog(categories: StoreCategory[]) {
  const queries = homeCatalogQueries(categories);
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SECRET_KEY) {
    return projectHomeCatalog(queries, [], []);
  }

  const service = createOrderServerClient();
  const result = await Promise.all(queries.map((query) =>
    service.rpc('catalog_search_page', {
      ...catalogPageArgs({
        ...DEFAULT_CATALOG_FILTERS,
        category: query.category,
        sort: query.sort,
      }, 1),
      p_page_size: query.limit,
    }),
  ));
  if (result.some((response) => response.error)) {
    console.error('Ana sayfa katalog seçimleri alınamadı:', result.find((item) => item.error)?.error?.code);
    throw new Error('Ana sayfa ürünleri şu anda yüklenemiyor.');
  }

  const pages = result.map((response) => (response.data ?? []) as CatalogPageMatch[]);
  const ids = homeCatalogProductIds(pages);
  if (!ids.length) return projectHomeCatalog(queries, pages, []);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .in('id', ids)
    .limit(ids.length);
  if (error) {
    console.error('Ana sayfa ürün detayları yüklenemedi:', error.code);
    throw new Error('Ana sayfa ürünleri şu anda yüklenemiyor.');
  }
  return projectHomeCatalog(queries, pages, await transformRows((data ?? []) as ProductRow[]));
}
