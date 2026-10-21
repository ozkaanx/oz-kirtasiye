import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) redirect('/admin/giris');
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/admin/giris');
  const { data: admin } = await supabase
    .from('store_admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) redirect('/admin/giris?yetki=yok');
  return children;
}
