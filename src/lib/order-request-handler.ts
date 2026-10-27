import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOKIE = 'oz-order-session';
const MAX_BYTES = 10_000;
type RecordValue = Record<string, unknown>;
type DbResult<T> = { data: T[] | null; error: { code: string; message: string } | null };
type OrderResult = {
  id: string;
  reference: string;
  subtotal: number | string;
  shipping_fee: number | string;
  total: number | string;
  delivery_method: string;
  discount_amount: number | string;
  code: string | null;
  campaign_name: string | null;
  replayed: boolean;
};
export type OrderRequestDependencies = {
  requestId?: string;
  enabled: boolean;
  configured: boolean;
  secret: string | undefined;
  noticeVersion: string;
  trustedIpHeader: string | null;
  getUserId: () => Promise<string | null>;
  consumeLimits: (args: {
    p_actor_key: string;
    p_ip_key: string | null;
  }) => PromiseLike<DbResult<{ allowed: boolean; retry_after: number }>>;
  submit: (args: {
    p_request_key: string;
    p_request_hash: string;
    p_payload: RecordValue;
    p_customer_user_id: string | null;
  }) => PromiseLike<DbResult<OrderResult>>;
  onError?: (event: string, code?: string) => void;
};

export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
const object = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const sign = (secret: string, value: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

/** Only explicitly trusted proxy headers are read; arbitrary X-Forwarded-For is ignored. */
export function orderRequestIdentity(
  request: Request,
  userId: string | null,
  secret: string,
  trustedIpHeader: string | null,
) {
  const cookie =
    request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? '';
  const match = /^([0-9a-f]{64})\.([0-9a-f]{64})$/.exec(cookie);
  const valid =
    match !== null &&
    timingSafeEqual(
      Buffer.from(match[2], 'hex'),
      Buffer.from(sign(secret, `session:${match[1]}`), 'hex'),
    );
  const session = valid && match ? match[1] : randomBytes(32).toString('hex');
  let ipKey: string | null = null;
  if (trustedIpHeader) {
    const raw = request.headers.get(trustedIpHeader)?.trim() ?? '';
    const family = isIP(raw);
    if (!family)
      throw new RequestError('İstek kaynağı doğrulanamadı. Lütfen daha sonra dene.', 503);
    const ip = family === 6 ? new URL(`http://[${raw}]`).hostname : raw;
    ipKey = sign(secret, `ip:${ip}`);
  }
  return {
    actorKey: sign(secret, userId ? `user:${userId}` : `browser:${session}`),
    ipKey,
    cookie:
      userId || valid
        ? null
        : `${COOKIE}=${session}.${sign(secret, `session:${session}`)}; Path=/api/order-requests; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
  };
}

/** Bound streamed bodies before buffering; count bytes rather than JS characters. */
export async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_BYTES)
    throw new RequestError('İstek fazla büyük.', 413);
  if (!request.body) throw new RequestError('İstek okunamadı.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new RequestError('İstek fazla büyük.', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw new RequestError('İstek okunamadı.');
    }
  } finally {
    reader.releaseLock();
  }
}

/** Fixed shape for the DB call/hash. Browser prices and user IDs never enter either. */
function normalizePayload(body: RecordValue, noticeVersion: string): RecordValue {
  const fields = ['customerName', 'phone', 'city', 'district', 'address', 'note'] as const;
  if (fields.some((field) => typeof body[field] !== 'string'))
    throw new RequestError('Eksik teslimat bilgisi.');
  if (
    body.preInformationRead !== true ||
    body.privacyNoticeRead !== true ||
    body.noticeVersion !== noticeVersion
  )
    throw new RequestError(
      'Ön bilgilendirmeyi ve KVKK açıklamasını okumalı, ardından tekrar denemelisin.',
    );
  if (body.deliveryMethod !== 'shipping' && body.deliveryMethod !== 'pickup')
    throw new RequestError('Bir teslimat yöntemi seçmelisin.');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20)
    throw new RequestError('Sepet geçersiz.');
  const items = body.items
    .map((item: unknown) => {
      if (
        !object(item) ||
        typeof item.productId !== 'string' ||
        !UUID.test(item.productId) ||
        (item.variantId != null &&
          (typeof item.variantId !== 'string' || !UUID.test(item.variantId))) ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      )
        throw new RequestError('Sepet geçersiz.');
      return {
        productId: item.productId.toLowerCase(),
        variantId: typeof item.variantId === 'string' ? item.variantId.toLowerCase() : null,
        quantity: item.quantity,
      };
    })
    .sort((a, b) => `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`));
  if (!object(body.billing)) throw new RequestError('Fatura bilgilerini tamamlamalısın.');
  const billing: RecordValue = {};
  for (const field of ['buyerType', 'recipientName', 'city', 'district', 'address']) {
    if (typeof body.billing[field] !== 'string')
      throw new RequestError('Fatura bilgilerini tamamlamalısın.');
    billing[field] = body.billing[field];
  }
  for (const field of ['companyName', 'taxOffice', 'taxNumber']) {
    if (body.billing[field] != null && typeof body.billing[field] !== 'string')
      throw new RequestError('Fatura bilgileri geçersiz.');
    billing[field] = body.billing[field] ?? null;
  }
  if (
    body.couponCode != null &&
    (typeof body.couponCode !== 'string' || body.couponCode.length > 32)
  )
    throw new RequestError('Kupon kodu geçersiz.');
  return {
    ...Object.fromEntries(fields.map((field) => [field, body[field]])),
    items,
    billing,
    deliveryMethod: body.deliveryMethod,
    preInformationRead: true,
    privacyNoticeRead: true,
    noticeVersion,
    couponCode:
      typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() || null : null,
  };
}

export async function handleOrderRequest(
  request: Request,
  deps: OrderRequestDependencies,
): Promise<Response> {
  let responseCookie: string | null = null;
  const json = (body: unknown, status: number, extra: Record<string, string> = {}) => {
    const response = Response.json(body, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(deps.requestId ? { 'X-Request-Id': deps.requestId } : {}),
        ...extra,
      },
    });
    if (responseCookie) response.headers.set('Set-Cookie', responseCookie);
    return response;
  };
  try {
    if (!deps.enabled || !deps.secret || !deps.configured) {
      deps.onError?.('order_service_unavailable');
      return json({ message: 'Sipariş talepleri henüz aktif değil.' }, 503);
    }
    if (request.headers.get('origin') !== new URL(request.url).origin)
      return json({ message: 'Geçersiz kaynak.' }, 403);
    if (
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      return json({ message: 'Geçersiz istek.' }, 415);
    const key = request.headers.get('idempotency-key');
    if (!key || !UUID.test(key))
      throw new RequestError('İşlem anahtarı eksik veya geçersiz. Sayfayı yenileyip tekrar dene.');
    const body = await readBody(request);
    if (!object(body) || body.website) throw new RequestError('Geçersiz form.');
    const userId = await deps.getUserId();
    const identity = orderRequestIdentity(request, userId, deps.secret, deps.trustedIpHeader);
    responseCookie = identity.cookie;
    const limit = await deps.consumeLimits({
      p_actor_key: identity.actorKey,
      p_ip_key: identity.ipKey,
    });
    if (limit.error || !limit.data?.[0]) {
      deps.onError?.('order_rate_limit_unavailable', limit.error?.code);
      return json({ message: 'Sipariş servisi şu anda kullanılamıyor. Lütfen tekrar dene.' }, 503, {
        'Retry-After': '30',
      });
    }
    if (!limit.data[0].allowed) {
      const delay = Math.max(1, Math.min(3600, Math.ceil(Number(limit.data[0].retry_after)) || 60));
      return json(
        { message: 'Çok fazla istek gönderdin. Bir süre bekleyip aynı talebi tekrar dene.' },
        429,
        { 'Retry-After': String(delay) },
      );
    }
    const payload = normalizePayload(body, deps.noticeVersion);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ userId, payload }))
      .digest('hex');
    const { data, error } = await deps.submit({
      p_request_key: key,
      p_request_hash: fingerprint,
      p_payload: payload,
      p_customer_user_id: userId,
    });
    if (error) {
      if (error.code === '22023' || error.code === 'PT409')
        return json({ message: error.message }, error.code === 'PT409' ? 409 : 400);
      deps.onError?.('order_submission_failed', error.code);
      return json(
        { message: 'Sipariş servisi şu anda kullanılamıyor. Aynı talebi tekrar deneyebilirsin.' },
        503,
      );
    }
    const result = data?.[0];
    if (!result) {
      deps.onError?.('order_submission_empty');
      return json({ message: 'Talep sonucu alınamadı. Aynı talebi tekrar dene.' }, 503);
    }
    return json(
      {
        id: result.id,
        reference: result.reference,
        subtotal: Number(result.subtotal),
        discountAmount: Number(result.discount_amount),
        couponCode: result.code,
        campaignName: result.campaign_name,
        shippingFee: Number(result.shipping_fee),
        total: Number(result.total),
        deliveryMethod: result.delivery_method,
      },
      result.replayed ? 200 : 201,
      { 'Idempotency-Replayed': String(result.replayed) },
    );
  } catch (error) {
    if (error instanceof RequestError) return json({ message: error.message }, error.status);
    deps.onError?.('order_request_unexpected');
    return json(
      { message: 'Sipariş servisi şu anda kullanılamıyor. Aynı talebi tekrar dene.' },
      503,
    );
  }
}
