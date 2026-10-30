import type { Metadata } from 'next';
import { AdminDeliverySettings } from '@/components/admin/admin-delivery-settings';
import { getStoreSettings } from '@/lib/store-settings';
export const metadata: Metadata = {
  title: 'Kargo ve Teslimat Ayarları',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function DeliverySettingsPage() {
  return <AdminDeliverySettings initialSettings={await getStoreSettings({ required: true })} />;
}
