import { readBody, RequestError } from './order-request-handler.ts';

type Quote = {
  subtotal: number | string;
  discount_amount: number | string;
  shipping_fee: number | string;
  total: number | string;
  code: string | null;
  campaign_name: string | null;
};
export type CouponQuoteDependencies = {
  configured: boolean;
  requestId: string;
  getUserId: () => Promise<string | null>;
  quote: (args: {
    p_items: unknown[];
    p_delivery_method: string;
    p_coupon_code: string | null;
    p_customer_user_id: string | null;
    p_phone: null;
  }) => PromiseLike<{ data: Quote[] | null; error: { code: string; message: string } | null }>;
  onError: (
    event: 'unavailable' | 'database_error' | 'empty_result' | 'unexpected',
    code?: string,
  ) => void;
};
export async function handleCouponQuote(request: Request, deps: CouponQuoteDependencies) {
  const json = (message: string, status: number) =>
    Response.json(
      { message: message + (status >= 500 ? ` Takip kodu: ${deps.requestId}` : '') },
      {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': deps.requestId },
      },
    );
  try {
    if (!deps.configured) {
      deps.onError('unavailable');
      return json('Kupon doğrulaması şu anda kapalı.', 503);
    }
    if (request.headers.get('origin') !== new URL(request.url).origin)
      return json('Geçersiz kaynak.', 403);
    if (
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      return json('Geçersiz içerik türü.', 415);
    const body = await readBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json('Kupon veya sepet bilgileri geçersiz.', 400);
    const input = body as Record<string, unknown>;
    if (
      !Array.isArray(input.items) ||
      input.items.length < 1 ||
      input.items.length > 20 ||
      !['shipping', 'pickup'].includes(String(input.deliveryMethod)) ||
      (input.couponCode !== undefined &&
        (typeof input.couponCode !== 'string' || input.couponCode.length > 32))
    )
      return json('Kupon veya sepet bilgileri geçersiz.', 400);
    const userId = await deps.getUserId();
    const { data, error } = await deps.quote({
      p_items: input.items,
      p_delivery_method: String(input.deliveryMethod),
      p_coupon_code: typeof input.couponCode === 'string' ? input.couponCode : null,
      p_customer_user_id: userId,
      p_phone: null,
    });
    if (error) {
      if (error.code === '22023') return json(error.message, 400);
      deps.onError('database_error', error.code);
      return json('Kupon servisine ulaşılamadı. Lütfen tekrar dene.', 503);
    }
    const record = data?.[0];
    if (!record) {
      deps.onError('empty_result');
      return json('Kupon sonucu alınamadı.', 503);
    }
    return Response.json(
      {
        subtotal: Number(record.subtotal),
        discountAmount: Number(record.discount_amount),
        shippingFee: Number(record.shipping_fee),
        total: Number(record.total),
        code: record.code,
        campaignName: record.campaign_name,
      },
      { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': deps.requestId } },
    );
  } catch (error) {
    if (error instanceof RequestError) return json(error.message, error.status);
    deps.onError('unexpected');
    return json('Kupon servisine ulaşılamadı. Lütfen tekrar dene.', 503);
  }
}
