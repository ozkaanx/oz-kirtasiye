import type { Metadata } from 'next';
import { CheckoutRequestForm } from '@/components/checkout/checkout-request-form';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = {
  title: 'Sipariş Talebi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function OrderRequestPage() {
  const settings = await getStoreSettings();
  return (
    <CheckoutRequestForm
      settings={settings}
      enabled={process.env.ORDER_REQUESTS_ENABLED === 'true' && !!process.env.SUPABASE_SECRET_KEY}
    />
  );
}
