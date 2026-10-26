import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 70);
  if (q.length < 2 || !hasSupabaseConfig()) return NextResponse.json({ products: [] });
  try {
    const supabase = await createServerSupabase();
    // Escape LIKE wildcard characters to prevent unintended wildcard searches.
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    const { data, error } = await supabase
      .from('products')
      .select('id,name,slug,price,has_variants,product_images(storage_path,sort_order)')
      .eq('is_active', true)
      .ilike('name', `%${escaped}%`)
      .order('name', { ascending: true })
      .limit(6);
    if (error) throw error;
    const products = (data ?? []).map((product) => {
      const images = product.product_images as { storage_path: string; sort_order: number }[] | null;
      const path = images?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.has_variants ? null : Number(product.price),
        imageUrl: path ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl : null,
      };
    });
    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Arama önerileri alınamadı:', error);
    return NextResponse.json({ products: [] }, { status: 503 });
  }
}
