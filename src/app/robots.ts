import type { MetadataRoute } from 'next';
import { absoluteStoreUrl, isSeoPublic } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!isSeoPublic()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/', '/api/', '/auth/', '/hesabim', '/sepet', '/siparis',
        '/favoriler', '/giris', '/kayit', '/sifre-yenile', '/sifremi-unuttum',
      ],
    },
    sitemap: absoluteStoreUrl('/sitemap.xml') ?? undefined,
  };
}
