import type { Metadata } from 'next';
import { CheckoutRequestForm } from '@/components/checkout/checkout-request-form';
import { getStoreSettings } from '@/lib/store-settings';
import { createServerSupabase } from '@/lib/supabase/server';
import type { CustomerAddress, CustomerProfile } from '@/lib/customer';

export const metadata: Metadata = {
  title: 'Sipariş Talebi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function OrderRequestPage() {
  const settings = await getStoreSettings();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let addresses: CustomerAddress[] = [];
  let profile: CustomerProfile | null = null;
  if (user) {
    const [addressResult, profileResult] = await Promise.all([
      supabase
        .from('customer_addresses')
        .select('id,user_id,label,recipient_name,phone,city,district,address,is_default,created_at')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('customer_profiles')
        .select('user_id,full_name,phone')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    addresses = (addressResult.data ?? []) as CustomerAddress[];
    profile = (profileResult.data as CustomerProfile | null) ?? {
      user_id: user.id,
      full_name:
        typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '',
      phone: null,
    };
  }
  return (
    <CheckoutRequestForm
      settings={settings}
      savedAddresses={addresses}
      profile={profile}
      loggedIn={!!user}
      enabled={process.env.ORDER_REQUESTS_ENABLED === 'true' && !!process.env.SUPABASE_SECRET_KEY}
    />
  );
}
