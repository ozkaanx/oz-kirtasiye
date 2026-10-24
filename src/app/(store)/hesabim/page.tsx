import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { CustomerAccount } from '@/components/account/customer-account';
import type { CustomerAddress, CustomerOrder, CustomerProfile } from '@/lib/customer';

export const metadata: Metadata = { title: 'Hesabım', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/giris?next=%2Fhesabim');

  const [profileResult, addressesResult, ordersResult] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select('user_id,full_name,phone')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('customer_addresses')
      .select('id,user_id,label,recipient_name,phone,city,district,address,is_default,created_at')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('order_requests')
      .select(
        'id,reference,created_at,status,payment_status,delivery_method,total,shipping_fee,order_request_items(product_name,quantity,line_total)',
      )
      .eq('customer_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  return (
    <CustomerAccount
      userId={user.id}
      email={user.email ?? ''}
      initialProfile={
        (profileResult.data as CustomerProfile | null) ?? {
          user_id: user.id,
          full_name:
            typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '',
          phone: null,
        }
      }
      initialAddresses={(addressesResult.data ?? []) as CustomerAddress[]}
      initialOrders={(ordersResult.data ?? []) as CustomerOrder[]}
      loadError={
        profileResult.error || addressesResult.error || ordersResult.error
          ? 'Bazı hesap bilgileri yüklenemedi. Yenileyip tekrar deneyin.'
          : undefined
      }
    />
  );
}
