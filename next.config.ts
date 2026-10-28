import type { NextConfig } from 'next';
import { isAllowedSupabaseUrl } from './src/lib/supabase/config';

/** Restrict Next Image optimizer to this project's public Supabase product bucket. */
const storageUrl = (() => {
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return isAllowedSupabaseUrl(parsed.href) ? parsed : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow the explicitly trusted LAN hostname when testing next dev on a phone.
  // Add LOCAL_DEV_HOST to .env.local if your computer receives a new IP address.
  allowedDevOrigins:
    process.env.NODE_ENV === 'development'
      ? [process.env.LOCAL_DEV_HOST?.trim() || '192.168.1.131']
      : [],
  images: {
    remotePatterns: storageUrl
      ? [
          {
            protocol: storageUrl.protocol === 'https:' ? 'https' : 'http',
            hostname: storageUrl.hostname,
            port: storageUrl.port,
            pathname: '/storage/v1/object/public/product-images/**',
            search: '',
          },
        ]
      : [],
    minimumCacheTTL: 3600,
  },
};

export default nextConfig;
