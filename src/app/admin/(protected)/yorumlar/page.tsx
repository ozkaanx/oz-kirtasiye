import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminReviewModeration } from '@/components/admin/admin-review-moderation';
import {
  parseReviewSearch,
  reviewSearchArgs,
  type ReviewSearchResult,
} from '@/lib/admin-review-search';
import { operationTrace } from '@/lib/operation-trace';
export const metadata: Metadata = {
  title: 'Ürün yorumları',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = parseReviewSearch(await searchParams);
  const trace = operationTrace('admin_review_search');
  let result: ReviewSearchResult | null = null;
  let loadError: string | null = null;
  try {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc('admin_search_reviews', reviewSearchArgs(search));
    if (error || !data || !Array.isArray(data.rows)) {
      trace.error(error ? 'database_error' : 'empty_result', error?.code);
      loadError = 'Yorumlar yüklenemedi. Tekrar deneyin. Takip kodu: ' + trace.requestId;
    } else result = data as ReviewSearchResult;
  } catch {
    trace.error('unexpected');
    loadError = 'Yorum servisine ulaşılamadı. Takip kodu: ' + trace.requestId;
  }
  return (
    <AdminReviewModeration
      key={JSON.stringify(search)}
      result={result}
      search={search}
      loadError={loadError}
    />
  );
}
