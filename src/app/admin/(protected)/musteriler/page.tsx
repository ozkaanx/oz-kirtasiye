import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { CrmCustomers, type CrmCustomer } from '@/components/admin/crm-customers';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Müşteri Yönetimi', robots: { index: false, follow: false } };
export default async function CustomersPage() {
 const db = await createServerSupabase();
 const { data, error } = await db.rpc('admin_crm_customers');
 const customers: CrmCustomer[] = (data ?? []).map((c: Record<string, unknown>) => ({
  userId: String(c.user_id), email: String(c.email ?? ''), name: String(c.full_name ?? ''), phone: String(c.phone ?? ''),
  registeredAt: String(c.registered_at), orderCount: Number(c.order_count)||0,
  completedCount: Number(c.completed_count)||0, requestedTotal: Number(c.requested_total)||0,
  lastOrderAt: c.last_order_at ? String(c.last_order_at) : null,
 }));
 return <CrmCustomers customers={customers} error={error?.message ?? null} capped={customers.length===5000}/>;
}
