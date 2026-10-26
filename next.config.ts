import type { NextConfig } from 'next';

/** Restrict Next Image optimizer to this project's public Supabase product bucket. */
const storageHost = (() => {
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: storageHost ? [{
      protocol: 'https',
      hostname: storageHost,
      pathname: '/storage/v1/object/public/product-images/**',
      search: '',
    }] : [],
    minimumCacheTTL: 3600,
  },
};

export default nextConfig;
