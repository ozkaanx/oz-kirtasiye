import { descendantIds, type StoreCategory } from './category-utils';
import type { LiveProduct, LiveVariant } from './real-catalog';

export type CatalogSort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'name';

export type CatalogFilters = {
  category: string;
  q: string;
  sort: CatalogSort;
  min: string;
  max: string;
  color: string;
  size: string;
  stock: boolean;
  campaign: boolean;
};

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  category: 'all',
  q: '',
  sort: 'featured',
  min: '',
  max: '',
  color: '',
  size: '',
  stock: false,
  campaign: false,
};

const sorts: CatalogSort[] = ['featured', 'newest', 'price-asc', 'price-desc', 'name'];

function safePrice(value: string | null): string {
  if (!value) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000_000
    ? String(parsed)
    : '';
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get('sort') as CatalogSort | null;
  return {
    category: (params.get('category') || 'all').slice(0, 100),
    q: (params.get('q') || '').slice(0, 120),
    sort: sort && sorts.includes(sort) ? sort : 'featured',
    min: safePrice(params.get('min')),
    max: safePrice(params.get('max')),
    color: (params.get('color') || '').slice(0, 100),
    size: (params.get('size') || '').slice(0, 100),
    stock: params.get('stock') === '1',
    campaign: params.get('campaign') === '1',
  };
}

export function serializeCatalogFilters(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.q.trim()) params.set('q', filters.q.trim().slice(0, 120));
  if (filters.sort !== 'featured') params.set('sort', filters.sort);
  const min = safePrice(filters.min);
  const max = safePrice(filters.max);
  if (min) params.set('min', min);
  if (max) params.set('max', max);
  if (filters.color) params.set('color', filters.color);
  if (filters.size) params.set('size', filters.size);
  if (filters.stock) params.set('stock', '1');
  if (filters.campaign) params.set('campaign', '1');
  return params.toString();
}

/** Match with tolerant Turkish accent handling: kalem, Kırmızı, kirmizi, etc. */
export function foldSearch(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function effectivePrice(product: Pick<LiveProduct, 'price' | 'promotion'>): number {
  return product.promotion?.discountedPrice ?? product.price;
}

function variantPrice(variant: LiveVariant): number {
  return variant.promotion?.discountedPrice ?? variant.price;
}

function matchesFacet(value: string, expected: string): boolean {
  return !expected || foldSearch(value.trim()) === foldSearch(expected.trim());
}

export function catalogFacets(products: LiveProduct[], categories: StoreCategory[], categorySlug: string) {
  const selectedCategory = categories.find((category) => category.slug === categorySlug);
  const allowed = selectedCategory ? descendantIds(categories, selectedCategory.id) : null;
  const colors = new Map<string, string>();
  const sizes = new Map<string, string>();
  for (const product of products) {
    if (allowed && (!product.category_id || !allowed.has(product.category_id))) continue;
    for (const variant of product.variants) {
      if (!variant.is_active) continue;
      for (const [value, values] of [[variant.color, colors], [variant.size, sizes]] as const) {
        const trimmed = value.trim();
        if (trimmed) values.set(foldSearch(trimmed), values.get(foldSearch(trimmed)) ?? trimmed);
      }
    }
  }
  const sort = (a: string, b: string) => a.localeCompare(b, 'tr');
  return { colors: [...colors.values()].sort(sort), sizes: [...sizes.values()].sort(sort) };
}

function categoryKeywords(categoryId: string | null, categoriesById: Map<string, StoreCategory>): string {
  const names: string[] = [];
  const visited = new Set<string>();
  let current = categoryId;
  while (current && !visited.has(current) && visited.size < 25) {
    visited.add(current);
    const category = categoriesById.get(current);
    if (!category) break;
    names.push(category.name);
    current = category.parent_id;
  }
  return names.join(' ');
}

/**
 * Filter and project each card to a qualifying variant. A blue-size-L filter never
 * displays the cheaper price of a red-size-S variant that did not match the filter.
 */
export type FilteredLiveProduct = LiveProduct & { filterVariantId?: string };

export function filterCatalogProducts(
  products: LiveProduct[],
  categories: StoreCategory[],
  filters: CatalogFilters,
): FilteredLiveProduct[] {
  const selectedCategory = categories.find((category) => category.slug === filters.category);
  if (filters.category !== 'all' && !selectedCategory) return [];
  const allowedCategories = selectedCategory ? descendantIds(categories, selectedCategory.id) : null;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const searchWords = foldSearch(filters.q.trim()).split(/\s+/).filter(Boolean);
  const min = safePrice(filters.min) ? Number(filters.min) : null;
  const max = safePrice(filters.max) ? Number(filters.max) : null;
  if (min != null && max != null && min > max) return [];
  const inPriceRange = (value: number) =>
    (min == null || value >= min) && (max == null || value <= max);

  const output: FilteredLiveProduct[] = [];
  for (const product of products) {
    if (allowedCategories && (!product.category_id || !allowedCategories.has(product.category_id))) {
      continue;
    }
    const baseSearch = foldSearch(
      [product.name, product.description ?? '', categoryKeywords(product.category_id, categoryById)].join(' '),
    );
    const searchContent = `${baseSearch} ${foldSearch(product.variants.flatMap((v) => [v.color, v.size]).join(' '))}`;
    if (searchWords.some((word) => !searchContent.includes(word))) continue;
    // When the search itself refers to a color/size, show that matching variant.
    const variantWords = searchWords.filter((word) => !baseSearch.includes(word));

    if (!product.has_variants) {
      if (filters.color || filters.size) continue;
      if (filters.stock && product.stock_quantity <= 0) continue;
      if (filters.campaign && !product.promotion && !product.campaignNotice) continue;
      if (!inPriceRange(effectivePrice(product))) continue;
      output.push(product);
      continue;
    }

    // If no variant is available there is still a browsable product with no filters.
    if (product.variants.length === 0) {
      if (filters.color || filters.size || filters.stock || filters.campaign) continue;
      if (!inPriceRange(effectivePrice(product))) continue;
      output.push(product);
      continue;
    }
    const eligible = product.variants.filter((variant) =>
      variant.is_active &&
      variantWords.every((word) => foldSearch(`${variant.color} ${variant.size}`).includes(word)) &&
      matchesFacet(variant.color, filters.color) &&
      matchesFacet(variant.size, filters.size) &&
      (!filters.stock || variant.stock_quantity > 0) &&
      (!filters.campaign || Boolean(variant.promotion || variant.campaignNotice)) &&
      inPriceRange(variantPrice(variant)),
    );
    if (!eligible.length) continue;

    // Prefer an available option and then the cheapest effective price.
    const display = [...eligible].sort((a, b) =>
      Number(b.stock_quantity > 0) - Number(a.stock_quantity > 0) ||
      variantPrice(a) - variantPrice(b) || a.price - b.price,
    )[0];
    output.push({
      ...product,
      filterVariantId: display.id,
      price: display.price,
      compare_at_price: display.compare_at_price,
      promotion: display.promotion,
      campaignNotice: display.campaignNotice,
      imageUrl: display.imageUrl ?? product.imageUrl,
      stock_quantity: eligible.reduce((sum, variant) => sum + variant.stock_quantity, 0),
    });
  }

  switch (filters.sort) {
    case 'price-asc':
      return output.sort((a, b) => effectivePrice(a) - effectivePrice(b) || a.name.localeCompare(b.name, 'tr'));
    case 'price-desc':
      return output.sort((a, b) => effectivePrice(b) - effectivePrice(a) || a.name.localeCompare(b.name, 'tr'));
    case 'name':
      return output.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    case 'newest':
      return output.sort((a, b) => b.created_at.localeCompare(a.created_at));
    default:
      return output.sort((a, b) =>
        Number(b.is_featured) - Number(a.is_featured) || b.created_at.localeCompare(a.created_at),
      );
  }
}
