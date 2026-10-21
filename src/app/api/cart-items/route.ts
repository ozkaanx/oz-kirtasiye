import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.json({ products: [] }, { status: 503 });
  const raw = request.nextUrl.searchParams.get('ids') ?? '';
  const ids = [...new Set(raw.split(',').filter(Boolean))];
  if (ids.length > 20 || ids.some((id) => !UUID.test(id))) {
    return NextResponse.json({ message: 'Geçersiz ürün listesi.' }, { status: 400 });
  }
  if (!ids.length) return NextResponse.json({ products: [] });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id,slug,name,price,stock_quantity,product_images(storage_path,sort_order)')
    .eq('is_active', true)
    .in('id', ids);
  if (error) return NextResponse.json({ message: 'Ürünler yüklenemedi.' }, { status: 503 });
  const products = (data ?? []).map((product) => {
    const path = product.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: Number(product.price),
      stock_quantity: product.stock_quantity,
      imageUrl: path
        ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        : null,
    };
  });
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
}
