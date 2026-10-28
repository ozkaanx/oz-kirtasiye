import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  AdminAutoCampaigns,
  type AutoCampaign,
  type Target,
} from '@/components/admin/admin-auto-campaigns';

export const metadata: Metadata = {
  title: 'Otomatik Kampanyalar',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const db = await createServerSupabase();
  const [campaignRes, categoryRes, productRes] = await Promise.all([
    db
      .from('automatic_campaigns')
      .select(
        'id,name,scope,category_id,product_id,discount_type,discount_value,max_discount,min_subtotal,starts_at,expires_at,priority,is_active',
      )
      .order('created_at', { ascending: false })
      .limit(500),
    db.rpc('admin_category_catalog'),
    db.from('automatic_campaigns').select('products(id,name)').not('product_id', 'is', null),
  ]);
  const campaigns: AutoCampaign[] = (campaignRes.data ?? []).map((row) => ({
    ...row,
    scope: row.scope as AutoCampaign['scope'],
    discount_type: row.discount_type as AutoCampaign['discount_type'],
    discount_value: Number(row.discount_value),
    min_subtotal: Number(row.min_subtotal),
    max_discount: row.max_discount === null ? null : Number(row.max_discount),
  }));
  return (
    <AdminAutoCampaigns
      campaigns={campaigns}
      categories={
        (categoryRes.data?.categories ?? []).filter(
          (c: { is_active: boolean }) => c.is_active,
        ) as Target[]
      }
      products={
        (productRes.data ?? []).flatMap((row) =>
          row.products ? [row.products] : [],
        ) as unknown as Target[]
      }
      loadError={
        campaignRes.error?.message ??
        categoryRes.error?.message ??
        productRes.error?.message ??
        null
      }
    />
  );
}
