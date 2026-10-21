/** Client-safe category helpers. No Supabase or server-only imports. */
export type StoreCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
};

export const CATEGORY_ARTWORK = [
  { label: 'Defter ve ajanda', path: '/illustrations/notebook.svg' },
  { label: 'Kalem', path: '/illustrations/pencils.svg' },
  { label: 'Boya ve sanat', path: '/illustrations/paints.svg' },
  { label: 'Oyuncak', path: '/illustrations/blocks.svg' },
  { label: 'Çanta', path: '/illustrations/bag.svg' },
  { label: 'Ofis', path: '/illustrations/sticky.svg' },
  { label: 'Diğer', path: '/illustrations/puzzle.svg' },
] as const;

const COLORS = ['#f8e4ff', '#e2efff', '#fff0d7', '#ffe5e8', '#e2f6ed', '#eee9ff'];

export function categoryArtwork(category: StoreCategory) {
  if (category.image_path?.startsWith('/illustrations/')) return category.image_path;
  const name = `${category.slug} ${category.name}`.toLocaleLowerCase('tr-TR');
  if (name.includes('defter') || name.includes('ajanda')) return CATEGORY_ARTWORK[0].path;
  if (name.includes('kalem')) return CATEGORY_ARTWORK[1].path;
  if (name.includes('boya') || name.includes('sanat')) return CATEGORY_ARTWORK[2].path;
  if (name.includes('oyuncak') || name.includes('oyun')) return CATEGORY_ARTWORK[3].path;
  if (name.includes('canta') || name.includes('çanta')) return CATEGORY_ARTWORK[4].path;
  if (name.includes('ofis')) return CATEGORY_ARTWORK[5].path;
  return CATEGORY_ARTWORK[6].path;
}

export function categoryColor(index: number) {
  return COLORS[index % COLORS.length];
}

export function slugifyTurkish(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function flattenCategories<
  T extends Pick<StoreCategory, 'id' | 'parent_id' | 'sort_order' | 'name'>,
>(categories: T[]): { category: T; depth: number }[] {
  const result: { category: T; depth: number }[] = [];
  const visited = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    categories
      .filter((c) => c.parent_id === parent)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'tr'))
      .forEach((category) => {
        if (visited.has(category.id)) return;
        visited.add(category.id);
        result.push({ category, depth });
        visit(category.id, depth + 1);
      });
  };
  visit(null, 0);
  // Include any orphaned records, without risking infinite loops on malformed relations.
  categories.forEach((category) => {
    if (!visited.has(category.id)) {
      visited.add(category.id);
      result.push({ category, depth: 0 });
    }
  });
  return result;
}

export function descendantIds(categories: Pick<StoreCategory, 'id' | 'parent_id'>[], id: string) {
  const found = new Set<string>([id]);
  let oldSize = 0;
  while (found.size !== oldSize) {
    oldSize = found.size;
    categories.forEach((category) => {
      if (category.parent_id && found.has(category.parent_id)) found.add(category.id);
    });
  }
  return found;
}
