import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createOrderServerClient } from '@/lib/supabase/order-server';
import { createServerSupabase } from '@/lib/supabase/server';
import { LEGAL_DOCUMENT_VERSION } from '@/lib/store-profile';
import { handleOrderRequest } from '@/lib/order-request-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let client: ReturnType<typeof createOrderServerClient> | undefined;
  const service = () => (client ??= createOrderServerClient());
  return handleOrderRequest(request, {
    enabled: process.env.ORDER_REQUESTS_ENABLED === 'true',
    configured: hasSupabaseConfig(),
    secret: process.env.SUPABASE_SECRET_KEY,
    noticeVersion: LEGAL_DOCUMENT_VERSION,
    // Only opt in to headers overwritten by a trusted ingress proxy.
    trustedIpHeader:
      process.env.VERCEL === '1'
        ? 'x-vercel-forwarded-for'
        : process.env.ORDER_REQUEST_TRUSTED_IP_HEADER || null,
    getUserId: async () => {
      const session = await createServerSupabase();
      const { data, error } = await session.auth.getUser();
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      return data.user?.id ?? null;
    },
    consumeLimits: (args) => service().rpc('consume_order_request_limits', args),
    submit: (args) => service().rpc('submit_order_request_idempotent', args),
    // Log event/code only; never request bodies, phones, tokens or IPs.
    onError: (event, code) => console.error(JSON.stringify({ event, code })),
  });
}
