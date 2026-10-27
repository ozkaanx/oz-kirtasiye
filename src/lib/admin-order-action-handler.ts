import { readBody, RequestError } from './order-request-handler.ts';
import type { OrderAction } from './admin-orders.ts';
export type AdminActionDependencies = {
  requestId: string;
  authorize: () => Promise<'admin' | 'unauthenticated' | 'forbidden'>;
  execute: (input: {
    orderId: string;
    action: OrderAction;
    carrier: string | null;
    trackingNumber: string | null;
    reason: string | null;
  }) => PromiseLike<{ error: { code: string; message: string } | null }>;
  onError: (event: 'database_error' | 'unexpected', code?: string) => void;
};
export async function handleAdminOrderAction(request: Request, deps: AdminActionDependencies) {
  const json = (message: string, status: number) =>
    Response.json(
      { message: message + (status >= 500 ? ` Takip kodu: ${deps.requestId}` : '') },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': deps.requestId } },
    );
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin)
      return json('Geçersiz kaynak.', 403);
    if (
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      return json('Geçersiz içerik türü.', 415);
    const access = await deps.authorize();
    if (access !== 'admin')
      return json('Yönetici oturumu gerekli.', access === 'unauthenticated' ? 401 : 403);
    const body = (await readBody(request)) as Record<string, unknown> | null;
    if (
      !body ||
      Array.isArray(body) ||
      typeof body.orderId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.orderId) ||
      typeof body.action !== 'string' ||
      !['contact', 'prepare', 'ship', 'deliver', 'cancel', 'pickup_collect'].includes(
        body.action,
      ) ||
      ['carrier', 'trackingNumber', 'cancelReason'].some(
        (key) => typeof body[key] !== 'string' || (body[key] as string).length > 500,
      )
    )
      return json('Sipariş işlemi geçersiz.', 400);
    const action = body.action as OrderAction;
    const { error } = await deps.execute({
      orderId: body.orderId,
      action,
      carrier: action === 'ship' ? (body.carrier as string).trim() : null,
      trackingNumber: action === 'ship' ? (body.trackingNumber as string).trim() : null,
      reason: action === 'cancel' ? (body.cancelReason as string).trim() || null : null,
    });
    if (error) {
      if (error.code === '22023') return json(error.message, 400);
      if (error.code === '42501') return json('Bu işlem için yetkin yok.', 403);
      deps.onError('database_error', error.code);
      return json('Sipariş güncellenemedi. Güncel durumu kontrol edip tekrar dene.', 503);
    }
    return json('Sipariş durumu güncellendi.', 200);
  } catch (error) {
    if (error instanceof RequestError) return json(error.message, error.status);
    deps.onError('unexpected');
    return json('Sipariş servisine ulaşılamadı. Güncel durumu kontrol edip tekrar dene.', 503);
  }
}
