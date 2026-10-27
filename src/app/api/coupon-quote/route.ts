import { createOrderServerClient } from '@/lib/supabase/order-server';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { handleCouponQuote } from '@/lib/coupon-quote-handler';
import { operationTrace } from '@/lib/operation-trace';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const trace = operationTrace('coupon_quote');
  return handleCouponQuote(request, {
    requestId: trace.requestId,
    configured: hasSupabaseConfig() && !!process.env.SUPABASE_SECRET_KEY,
    getUserId: async () => {
      const session = await createServerSupabase();
      const { data, error } = await session.auth.getUser();
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      return data.user?.id ?? null;
    },
    quote: (args) => createOrderServerClient().rpc('quote_order_savings', args),
    onError: trace.error,
  });
}
