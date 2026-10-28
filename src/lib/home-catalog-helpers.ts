import type { StoreCategory } from './category-utils';
import { projectCatalogPage, type CatalogPageMatch } from './catalog-page-helpers';
import type { FilteredLiveProduct } from './catalog-filters';
import type { LiveProduct } from './real-catalog';

export type HomeCatalogQuery = {
  kind: 'featured' | 'newest';
  key: string;
  category: string;
  sort: 'featured' | 'newest';
  limit: number;
};

export function homeCatalogQueries(categories: Pick<StoreCategory, 'slug' | 'parent_id'>[]): HomeCatalogQuery[] {
  const topCategories = categories.filter((category) => !category.parent_id).slice(0, 6);
  return [
    { kind: 'featured', key: 'all', category: 'all', sort: 'featured', limit: 8 },
    ...topCategories.map((category) => ({
      kind: 'featured' as const,
      key: category.slug,
      category: category.slug,
      sort: 'featured' as const,
      limit: 8,
    })),
    { kind: 'newest', key: 'newest', category: 'all', sort: 'newest', limit: 4 },
  ];
}

export function homeCatalogProductIds(pages: CatalogPageMatch[][]): string[] {
  return [...new Set(pages.flatMap((page) =>
    page.map((item) => item.product_id).filter((id): id is string => !!id),
  ))];
}

export function projectHomeCatalog(
  queries: HomeCatalogQuery[],
  pages: CatalogPageMatch[][],
  products: LiveProduct[],
): { featuredByCategory: Record<string, FilteredLiveProduct[]>; newestProducts: FilteredLiveProduct[] } {
  const featuredByCategory: Record<string, FilteredLiveProduct[]> = {};
  let newestProducts: FilteredLiveProduct[] = [];
  queries.forEach((query, index) => {
    const shown = projectCatalogPage(pages[index] ?? [], products);
    if (query.kind === 'newest') newestProducts = shown;
    else featuredByCategory[query.key] = shown;
  });
  return { featuredByCategory, newestProducts };
}
