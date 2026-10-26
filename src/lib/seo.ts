/** Server-side SEO configuration. No private keys are ever sent to the browser. */
export const STORE_NAME = 'Öz Kırtasiye';
export const STORE_DESCRIPTION =
  'Öz Kırtasiye: okul, kırtasiye, oyuncak ve yaratıcı hobi ürünleri. İstanbul Bağcılar Güneşli.';

/** Do not infer the canonical URL from request headers or a Vercel preview address. */
export function getSiteUrl(): URL | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.vercel.app')) return null;
    if (url.pathname !== '/') return null;
    return url;
  } catch {
    return null;
  }
}

/** Explicit opt-in for production only. Development and Vercel previews stay noindex. */
export function isSeoPublic(): boolean {
  return process.env.SEO_INDEXABLE === 'true' &&
    process.env.VERCEL_ENV !== 'preview' && getSiteUrl() !== null;
}

export function absoluteStoreUrl(path: string): string | null {
  const base = getSiteUrl();
  if (!base) return null;
  return new URL(path.replace(/^\/+/, ''), base).toString();
}

export function seoDescription(value: string | null | undefined, fallback = STORE_DESCRIPTION): string {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.length <= 155 ? text : `${text.slice(0, 152).trimEnd()}…`;
}

export function safeJsonLd(value: unknown): string {
  // JSON data is embedded in a script element: do not allow injected closing tags.
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
