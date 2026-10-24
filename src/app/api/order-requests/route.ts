import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createOrderServerClient } from '@/lib/supabase/order-server';
import { createServerSupabase } from '@/lib/supabase/server';
import { LEGAL_DOCUMENT_VERSION } from '@/lib/store-profile';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (process.env.ORDER_REQUESTS_ENABLED !== 'true' || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ message: 'Sipariş talepleri henüz aktif değil.' }, { status: 503 });
  }
  if (!hasSupabaseConfig())
    return NextResponse.json({ message: 'Mağaza yapılandırılmadı.' }, { status: 503 });
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'Geçersiz istek.' }, { status: 415 });
  }
  // Enforce same-origin requests (defence-in-depth; external automation still needs CAPTCHA/WAF).
  const origin = request.headers.get('origin');
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: 'Geçersiz kaynak.' }, { status: 403 });
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 10000) {
    return NextResponse.json({ message: 'İstek fazla büyük.' }, { status: 413 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 10000)
      return NextResponse.json({ message: 'İstek fazla büyük.' }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.website) {
      return NextResponse.json({ message: 'Geçersiz form.' }, { status: 400 });
    }
    const fields = ['customerName', 'phone', 'city', 'district', 'address', 'note'] as const;
    if (fields.some((field) => typeof body[field] !== 'string')) {
      return NextResponse.json({ message: 'Eksik teslimat bilgisi.' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      return NextResponse.json({ message: 'Sepet geçersiz.' }, { status: 400 });
    }
    if (
      body.preInformationRead !== true ||
      body.privacyNoticeRead !== true ||
      body.noticeVersion !== LEGAL_DOCUMENT_VERSION
    ) {
      return NextResponse.json(
        {
          message: 'Ön bilgilendirmeyi ve KVKK açıklamasını okumalı, ardından tekrar denemelisin.',
        },
        { status: 400 },
      );
    }
    if (body.deliveryMethod !== 'shipping' && body.deliveryMethod !== 'pickup') {
      return NextResponse.json({ message: 'Bir teslimat yöntemi seçmelisin.' }, { status: 400 });
    }
    // Verified server-side cookie session is the ONLY source of the customer identity.
    // A guest remains a guest; client-supplied user IDs are ignored.
    const sessionClient = await createServerSupabase();
    const { data: authData } = await sessionClient.auth.getUser();
    const supabase = createOrderServerClient();
    const { data, error } = await supabase.rpc('submit_order_request_with_delivery_for_customer', {
      p_customer_name: body.customerName,
      p_phone: body.phone,
      p_city: body.city,
      p_district: body.district,
      p_address: body.address,
      p_note: body.note,
      p_items: body.items,
      p_pre_information_read: true,
      p_privacy_notice_read: true,
      p_notice_version: LEGAL_DOCUMENT_VERSION,
      p_delivery_method: body.deliveryMethod,
      p_customer_user_id: authData.user?.id ?? null,
    });
    if (error) {
      const knownValidationError = error.code === '22023';
      return NextResponse.json(
        {
          message: knownValidationError
            ? error.message
            : 'Sipariş talebi oluşturulamadı. Lütfen tekrar deneyin.',
        },
        { status: 400 },
      );
    }
    const result = (
      data as
        | {
            id: string;
            reference: string;
            subtotal: number;
            shipping_fee: number;
            total: number;
            delivery_method: 'pickup' | 'shipping';
          }[]
        | null
    )?.[0];
    if (!result) return NextResponse.json({ message: 'Talep kaydedilemedi.' }, { status: 503 });
    return NextResponse.json(
      {
        id: result.id,
        reference: result.reference,
        subtotal: Number(result.subtotal),
        shippingFee: Number(result.shipping_fee),
        total: Number(result.total),
        deliveryMethod: result.delivery_method,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: 'İstek okunamadı.' }, { status: 400 });
  }
}
