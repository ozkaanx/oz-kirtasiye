import Link from 'next/link';
import { customerPageHref, type CustomerPage } from '@/lib/customer-pagination';

export function CustomerPagination({
  result,
  path,
  params = {},
  pageKey = 'page',
  label = 'Sayfalar',
}: {
  result: CustomerPage;
  path: string;
  params?: Record<string, string>;
  pageKey?: string;
  label?: string;
}) {
  if (result.pages <= 1) return null;
  return (
    <nav aria-label={label} className="customer-pagination">
      {result.page > 1 && (
        <Link
          href={customerPageHref(path, params, pageKey, result.page - 1)}
          className="button button-outline"
        >
          Önceki
        </Link>
      )}
      <span aria-live="polite">
        {result.total} kayıt · {result.page} / {result.pages}
      </span>
      {result.page < result.pages && (
        <Link
          href={customerPageHref(path, params, pageKey, result.page + 1)}
          className="button button-outline"
        >
          Sonraki
        </Link>
      )}
    </nav>
  );
}
