import type { StoreCategory } from './category-utils';

/** Root categories are sorted and inactive categories are never shown. */
export function mobileRootCategories(categories: StoreCategory[]): StoreCategory[] {
  const active = categories.filter((category) => category.is_active);
  const ids = new Set(active.map((category) => category.id));
  return active
    .filter((category) => !category.parent_id || !ids.has(category.parent_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'tr'));
}

/** Stable ordering for expandable subcategories; loops are blocked by max depth in UI. */
export function mobileChildCategories(categories: StoreCategory[], parentId: string): StoreCategory[] {
  return categories
    .filter((category) => category.is_active && category.parent_id === parentId && category.id !== parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'tr'));
}
