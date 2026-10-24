import { NextRequest, NextResponse } from 'next/server';
import { createOrderServerClient } from '@/lib/supabase/order-server';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function POST(request:NextRequest) {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({message:'Kupon doğrulaması şu anda kapalı.'},{status:503});
  }
  if (request.headers.get('origin')!==request.nextUrl.origin) {
    return NextResponse.json({message:'Geçersiz kaynak.'},{status:403});
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({message:'Geçersiz içerik türü.'},{status:415});
  }
  const len=Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len>10000) return NextResponse.json({message:'İstek fazla büyük.'},{status:413});
  try {
    const raw=await request.text();
    if (raw.length>10000) return NextResponse.json({message:'İstek fazla büyük.'},{status:413});
    const body=JSON.parse(raw) as Record<string,unknown>;
    if (!body || typeof body!=='object' || Array.isArray(body)
      || !Array.isArray(body.items) || body.items.length<1 || body.items.length>20
      || !['shipping','pickup'].includes(String(body.deliveryMethod))
      || (body.couponCode !== undefined && (typeof body.couponCode!=='string' || body.couponCode.length>32))) {
      return NextResponse.json({message:'Kupon veya sepet bilgileri geçersiz.'},{status:400});
    }
    const session=await createServerSupabase();
    const {data: authData}=await session.auth.getUser();
    const supabase=createOrderServerClient();
    const {data,error}=await supabase.rpc('quote_order_savings',{
      p_items:body.items,
      p_delivery_method:body.deliveryMethod,
      p_coupon_code:typeof body.couponCode==='string'?body.couponCode:null,
      p_customer_user_id:authData.user?.id??null,
      p_phone:null,
    });
    if (error) return NextResponse.json({
      message:error.code==='22023'?error.message:'Kupon kontrol edilemedi.'
    },{status:400});
    const record=(data as {subtotal:number;discount_amount:number;shipping_fee:number;total:number;code:string|null;campaign_name:string|null}[]|null)?.[0];
    if (!record) return NextResponse.json({message:'Kupon sonucu alınamadı.'},{status:503});
    return NextResponse.json({
      subtotal:Number(record.subtotal),discountAmount:Number(record.discount_amount),
      shippingFee:Number(record.shipping_fee),total:Number(record.total),code:record.code,campaignName:record.campaign_name
    },{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({message:'Kupon isteği okunamadı.'},{status:400});
  }
}
