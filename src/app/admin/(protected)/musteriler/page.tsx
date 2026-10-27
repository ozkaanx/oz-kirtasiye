import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminCustomers, type CrmOrder } from '@/components/admin/admin-customers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Müşteri Yönetimi', robots: { index: false, follow: false } };

export default async function CustomersPage() {
  const db = await createServerSupabase();
  const { data, error } = await db.from('order_requests')
    .select('id,customer_user_id,customer_name,phone,reference,status,total,created_at')
    .not('customer_user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  const rows: CrmOrder[] = (data ?? []).map(o => ({
    id: o.id,
    userId: o.customer_user_id!,
    name: o.customer_name ?? '',
    phone: o.phone ?? '',
    reference: o.reference ?? '',
    status: o.status ?? '',
    total: Number(o.total) || 0,
    createdAt: o.created_at,
  }));
  return <AdminCustomers orders={rows} error={error?.message ?? null} capped={rows.length === 2000}/>;
}
