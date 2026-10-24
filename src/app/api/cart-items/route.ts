import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { cartLineKey, type CartProduct } from '@/lib/cart-types';

export const dynamic = 'force-dynamic';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
type RequestedItem = { productId: string; variantId?: string | null };
type VariantRow = {
  id: string;
  product_id: string;
  color: string;
  size: string;
  price: number | string;
  stock_quantity: number;
  image_path: string | null;
  is_active: boolean;
};

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.json({ products: [] }, { status: 503 });
  let requests: RequestedItem[];
  try {
    const raw = request.nextUrl.searchParams.get('items');
    if (raw && raw.length > 3000)
      return NextResponse.json({ message: 'Çok uzun sepet.' }, { status: 400 });
    requests = raw
      ? (JSON.parse(raw) as RequestedItem[])
      : (request.nextUrl.searchParams.get('ids') ?? '')
          .split(',')
          .filter(Boolean)
          .map((productId) => ({ productId }));
  } catch {
    return NextResponse.json({ message: 'Sepet verisi geçersiz.' }, { status: 400 });
  }
  if (
    !Array.isArray(requests) ||
    requests.length > 20 ||
    requests.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        typeof item.productId !== 'string' ||
        !UUID.test(item.productId) ||
        (item.variantId != null &&
          (typeof item.variantId !== 'string' || !UUID.test(item.variantId))),
    )
  )
    return NextResponse.json({ message: 'Geçersiz ürün kimliği.' }, { status: 400 });
  if (!requests.length) return NextResponse.json({ products: [] });
  const ids = [...new Set(requests.map((item) => item.productId))];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(
      'id,slug,name,price,stock_quantity,has_variants,product_images(storage_path,sort_order)',
    )
    .eq('is_active', true)
    .in('id', ids);
  if (error) return NextResponse.json({ message: 'Sepet fiyatları yüklenemedi.' }, { status: 503 });
  const variantIds = [
    ...new Set(requests.map((item) => item.variantId).filter((id): id is string => !!id)),
  ];
  const variants: VariantRow[] = variantIds.length
    ? ((
        await supabase
          .from('product_variants')
          .select('id,product_id,color,size,price,stock_quantity,image_path,is_active')
          .in('id', variantIds)
          .eq('is_active', true)
      ).data ?? [])
    : [];
  const lookup = new Map((data ?? []).map((row) => [row.id, row]));
  const variantLookup = new Map(variants.map((v) => [v.id, v]));
  const products: CartProduct[] = [];
  for (const item of requests) {
    const product = lookup.get(item.productId);
    if (!product) continue;
    const variant = item.variantId ? variantLookup.get(item.variantId) : null;
    if (product.has_variants && (!variant || variant.product_id !== product.id)) continue;
    if (!product.has_variants && item.variantId) continue;
    const basePath = product.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    const path = variant?.image_path || basePath;
    products.push({
      id: product.id,
      variantId: variant?.id ?? null,
      key: cartLineKey(product.id, variant?.id),
      slug: product.slug,
      name: product.name,
      variantLabel: variant ? [variant.color, variant.size].filter(Boolean).join(' / ') : null,
      price: Number(variant ? variant.price : product.price),
      stock_quantity: variant ? variant.stock_quantity : product.stock_quantity,
      imageUrl: path
        ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        : null,
    });
  }
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'private, no-store' } });
}
