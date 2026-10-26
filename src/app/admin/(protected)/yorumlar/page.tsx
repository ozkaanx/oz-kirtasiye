import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminReviewModeration, type AdminReview, type ReviewStatus } from '@/components/admin/admin-review-moderation';

export const metadata: Metadata = { title: 'Ürün yorumları', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const db = await createServerSupabase();
  const { data, error } = await db.from('product_reviews')
    .select('id,product_id,rating,body,status,created_at')
    .order('created_at', { ascending: false }).limit(1000);
  const productIds = [...new Set((data ?? []).map(item => item.product_id))];
  const { data: products, error: productsError } = productIds.length
    ? await db.from('products').select('id,name').in('id', productIds)
    : { data: [] as { id: string; name: string }[], error: null };
  const names = new Map((products ?? []).map(item => [item.id, item.name]));
  const reviews: AdminReview[] = (data ?? []).map(item => ({
    id: item.id,
    product_id: item.product_id,
    product_name: names.get(item.product_id) ?? 'Ürün',
    rating: Number(item.rating),
    body: item.body,
    status: item.status as ReviewStatus,
    created_at: item.created_at,
  }));
  return <AdminReviewModeration initialReviews={reviews} loadError={error?.message ?? productsError?.message ?? null} />;
}
