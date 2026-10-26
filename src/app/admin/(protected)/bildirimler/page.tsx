import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminNotifications } from '@/components/admin/admin-notifications';
import type { StoreNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Bildirim Merkezi',
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage() {
  // Admin access is enforced by admin/(protected)/layout.tsx.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,audience,event_type,title,body,href,read_at,created_at')
    .eq('audience', 'admin')
    .order('created_at', { ascending: false })
    .limit(100);
  return (
    <AdminNotifications
      notifications={(data ?? []) as StoreNotification[]}
      loadError={error?.message ?? null}
    />
  );
}
