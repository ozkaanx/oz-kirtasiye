import { createServerSupabase } from '@/lib/supabase/server';
import { handleAdminOrderAction } from '@/lib/admin-order-action-handler';
import { operationTrace } from '@/lib/operation-trace';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const trace = operationTrace('admin_order_action');
  let client: Awaited<ReturnType<typeof createServerSupabase>>;
  return handleAdminOrderAction(request, {
    requestId: trace.requestId,
    authorize: async () => {
      client = await createServerSupabase();
      const { data, error } = await client.auth.getUser();
      if (error?.name === 'AuthSessionMissingError' || (!error && !data.user))
        return 'unauthenticated';
      if (error) throw error;
      const admin = await client
        .from('store_admins')
        .select('role')
        .eq('user_id', data.user!.id)
        .maybeSingle();
      if (admin.error) throw admin.error;
      return admin.data ? 'admin' : 'forbidden';
    },
    // Use the verified session, never a service-role client: RPC authorization and RLS still apply.
    execute: (input) =>
      input.action === 'pickup_collect'
        ? client.rpc('complete_pickup_order', { p_order_id: input.orderId })
        : client.rpc('manage_order_request', {
            p_order_id: input.orderId,
            p_action: input.action,
            p_carrier: input.carrier,
            p_tracking_number: input.trackingNumber,
            p_reason: input.reason,
          }),
    onError: trace.error,
  });
}
