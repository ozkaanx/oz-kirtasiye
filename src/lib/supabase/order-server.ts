import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

/** The private key must never be prefixed NEXT_PUBLIC_ or imported by a client component. */
export function createOrderServerClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Sunucu sipariş anahtarı tanımlanmadı.');
  return createClient(getSupabaseConfig().url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
