import { createServerSupabase } from '@/lib/supabase/server';
import { handleProductImport } from '@/lib/admin-import-handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  // The client is initialized inside authorization, before any file is parsed.
  let db: Awaited<ReturnType<typeof createServerSupabase>>;
  return handleProductImport(request, {
    authorize: async () => {
      db = await createServerSupabase();
      const {
        data: { user },
        error,
      } = await db.auth.getUser();
      if (error || !user) return 401;
      const { data: admin, error: adminError } = await db
        .from('store_admins')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (adminError) throw adminError;
      return admin ? 0 : 403;
    },
    run: (args) => db.rpc('admin_confirm_product_import', args),
  });
}
