import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { CustomerAccount } from '@/components/account/customer-account';
import type { CustomerAddress, CustomerOrder, CustomerProfile } from '@/lib/customer';
import { parseAccountTab } from '@/lib/account-ui';

export const metadata: Metadata = { title: 'Hesabım', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  const initialTab = parseAccountTab(tab);
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
        'id,reference,created_at,status,payment_status,delivery_method,total,shipping_fee,carrier,tracking_number,shipped_at,delivered_at,discount_amount,coupon_code,automatic_campaign_name,order_request_items(product_id,variant_id,product_name,variant_label,quantity,line_total),order_invoice_register(status,document_type,invoice_number,issue_date)',
      )
      .eq('customer_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  // Supabase returns the nested invoice relation as an array in this query.
  // Normalize it once for the account UI rather than asserting an incompatible type.
  const customerOrders: CustomerOrder[] = (ordersResult.data ?? []).map((order): CustomerOrder => {
    const invoice = order.order_invoice_register?.[0] ?? null;
    return {
      id: order.id,
      reference: order.reference,
      created_at: order.created_at,
      status: order.status,
      payment_status: order.payment_status,
      delivery_method: order.delivery_method,
      total: Number(order.total),
      shipping_fee: Number(order.shipping_fee),
      carrier: order.carrier ?? null,
      tracking_number: order.tracking_number ?? null,
      shipped_at: order.shipped_at ?? null,
      delivered_at: order.delivered_at ?? null,
      discount_amount: Number(order.discount_amount),
      coupon_code: order.coupon_code,
      automatic_campaign_name: order.automatic_campaign_name,
      order_request_items: (order.order_request_items ?? []).map((line) => ({
        product_id: line.product_id,
        variant_id: line.variant_id ?? null,
        product_name: line.product_name,
        variant_label: line.variant_label ?? null,
        quantity: Number(line.quantity),
        line_total: Number(line.line_total),
      })),
      order_invoice_register: invoice
        ? {
            status: invoice.status === 'issued' ? 'issued' : 'pending',
            document_type:
              invoice.document_type === 'e_fatura' || invoice.document_type === 'e_arsiv'
                ? invoice.document_type
                : null,
            invoice_number: invoice.invoice_number ?? null,
            issue_date: invoice.issue_date ?? null,
          }
        : null,
    };
  });

  return (
    <CustomerAccount
      initialTab={initialTab}
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
      initialOrders={customerOrders}
      loadError={
        profileResult.error || addressesResult.error || ordersResult.error
          ? 'Bazı hesap bilgileri yüklenemedi. Yenileyip tekrar deneyin.'
          : undefined
      }
    />
  );
}
