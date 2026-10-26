import { NextRequest, NextResponse } from 'next/server';
import { getProductRecommendations } from '@/lib/product-recommendations';

export const dynamic = 'force-dynamic';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('ids') ?? '';
  if (raw.length > 800) return NextResponse.json({ message: 'Geçersiz istek.' }, { status: 400 });
  const ids = [...new Set(raw.split(',').filter(Boolean))];
  if (ids.length > 20 || ids.some((id) => !UUID.test(id))) {
    return NextResponse.json({ message: 'Geçersiz ürün.' }, { status: 400 });
  }
  const products = await getProductRecommendations(ids, 4);
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'private, no-store' } });
}
