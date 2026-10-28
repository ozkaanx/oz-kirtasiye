import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { PRODUCT_FIELDS, transformRows, type ProductRow } from '@/lib/real-catalog';
import { parseFavoriteIds } from '@/lib/favorite-product-ids';
import { readBody, RequestError } from '@/lib/order-request-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/** Favorited IDs are supplied after localStorage hydration; never fetch the entire catalog. */
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ message: 'Geçersiz istek kaynağı.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    return json({ message: 'Geçersiz içerik türü.' }, 415);

  try {
    const payload = await readBody(request);
    const ids = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? parseFavoriteIds((payload as Record<string, unknown>).ids)
      : null;
    if (!ids) return json({ message: 'Geçersiz favori listesi.' }, 400);
    if (!ids.length) return json({ products: [] });
    if (!hasSupabaseConfig()) return json({ message: 'Ürün servisi kullanılamıyor.' }, 503);

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('is_active', true)
      .in('id', ids)
      .limit(ids.length);
    if (error) {
      console.error('Favoriler için ürünler sorgulanamadı:', error.code);
      return json({ message: 'Favori ürünler yüklenemedi.' }, 503);
    }
    const transformed = await transformRows((data ?? []) as ProductRow[]);
    const byId = new Map(transformed.map((product) => [product.id, product]));
    return json({ products: ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    }) });
  } catch (error) {
    if (error instanceof RequestError) return json({ message: error.message }, error.status);
    console.error('Favori ürünler yüklenirken beklenmeyen hata.');
    return json({ message: 'Favori ürünler yüklenemedi.' }, 503);
  }
}
