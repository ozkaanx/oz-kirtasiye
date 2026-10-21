export function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !key.includes("BURAYA_") && /^https:\/\//.test(url));
}

export function getSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase bağlantı bilgileri .env.local içinde eksik.");
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
