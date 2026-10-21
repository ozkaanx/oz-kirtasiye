import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components may be read-only. proxy.ts handles cookie refresh.
        }
      },
    },
  });
}
