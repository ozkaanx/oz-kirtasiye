import type { Metadata } from 'next';
import { CheckoutRequestForm } from '@/components/checkout/checkout-request-form';

export const metadata: Metadata = {
  title: 'Sipariş Talebi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default function OrderRequestPage() {
  return (
    <CheckoutRequestForm
      enabled={process.env.ORDER_REQUESTS_ENABLED === 'true' && !!process.env.SUPABASE_SECRET_KEY}
    />
  );
}
