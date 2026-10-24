import type { Metadata } from 'next';
import { AdminStoreSettings } from '@/components/admin/admin-store-settings';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = {
  title: 'İşletme Ayarları',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function StoreSettingsPage() {
  const settings = await getStoreSettings();
  return <AdminStoreSettings initialSettings={settings} />;
}
