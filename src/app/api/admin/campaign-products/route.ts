import { createServerSupabase } from '@/lib/supabase/server';
import { parseProductSearch, productSearchArgs } from '@/lib/admin-product-search';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const db = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) return json({ message: 'Giriş gerekli.' }, 401);
    const { data: admin, error: adminError } = await db
      .from('store_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return json({ message: 'Yönetici yetkisi gerekli.' }, 403);
    const params = new URL(request.url).searchParams;
    const { data, error } = await db.rpc(
      'admin_search_products',
      productSearchArgs(
        parseProductSearch({
          q: params.get('q') ?? '',
          page: params.get('page') ?? '1',
          visibility: 'active',
        }),
      ),
    );
    if (error || !data || !Array.isArray(data.rows)) throw error ?? new Error('Invalid response');
    return json({
      rows: data.rows.map((row: { id: string; name: string; sku: string | null }) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
      })),
      page: data.page,
      total: data.total,
      hasNext: data.hasNext,
      hasPrevious: data.hasPrevious,
    });
  } catch {
    console.error('admin_campaign_product_search_failed');
    return json({ message: 'Ürünler yüklenemedi. Yeniden deneyin.' }, 503);
  }
}
