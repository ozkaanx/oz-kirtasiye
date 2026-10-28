import { isIP } from 'node:net';

/** Server-side SEO configuration. No private keys are ever sent to the browser. */
export const STORE_NAME = 'Öz Kırtasiye';
export const STORE_DESCRIPTION =
  'Öz Kırtasiye: okul, kırtasiye, oyuncak ve yaratıcı hobi ürünleri. İstanbul Bağcılar Güneşli.';

/**
 * The canonical origin is an explicit, verified public domain only.
 * Never infer it from Host / forwarded headers, a preview URL or localhost.
 */
export function parseSiteUrl(raw: string | undefined | null): URL | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    const hostname = url.hostname.toLowerCase();
    const localHost =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      isIP(hostname.replace(/^\[|\]$/g, '')) !== 0;
    const temporaryHost = hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      url.port ||
      !hostname.includes('.') ||
      localHost ||
      temporaryHost
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export function getSiteUrl(): URL | null {
  return parseSiteUrl(process.env.SITE_URL);
}

/** Indexing requires three explicit conditions: public domain, production and opt-in. */
export function seoIndexingAllowed({
  siteUrl,
  indexable,
  nodeEnv,
  vercelEnv,
}: {
  siteUrl: string | undefined;
  indexable: string | undefined;
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
}): boolean {
  return (
    indexable === 'true' &&
    nodeEnv === 'production' &&
    (vercelEnv === undefined || vercelEnv === 'production') &&
    parseSiteUrl(siteUrl) !== null
  );
}

/** Preview, local development and unlaunched storefronts must remain noindex. */
export function isSeoPublic(): boolean {
  return seoIndexingAllowed({
    siteUrl: process.env.SITE_URL,
    indexable: process.env.SEO_INDEXABLE,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
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
