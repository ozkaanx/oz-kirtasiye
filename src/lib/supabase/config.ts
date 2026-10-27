/** Hosted APIs require HTTPS. HTTP is only allowed for a local Supabase stack. */
export function isAllowedSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

export function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !key.includes('BURAYA_') && isAllowedSupabaseUrl(url));
}

export function getSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase bağlantı bilgileri .env.local içinde eksik.');
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
