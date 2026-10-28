/** Favorites live in browser storage; the API only accepts bounded product IDs. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_FAVORITE_IDS = 100;

export function parseFavoriteIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_FAVORITE_IDS) return null;
  if (value.some((id) => typeof id !== 'string' || !UUID.test(id))) return null;
  return [...new Set((value as string[]).map((id) => id.toLowerCase()))];
}
