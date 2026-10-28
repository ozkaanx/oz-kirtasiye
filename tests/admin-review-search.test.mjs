import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseReviewSearch,
  reviewSearchArgs,
  reviewSearchHref,
} from '../src/lib/admin-review-search.ts';
test('review query normalization bounds pages and rejects ambiguous filters', () => {
  const defaults = { q: '', status: 'pending', page: 1 };
  assert.deepEqual(parseReviewSearch({}), defaults);
  assert.deepEqual(parseReviewSearch({ q: ['a'], status: ['all'], page: ['2'] }), defaults);
  for (const page of ['0', '-1', '1.5', '1e2', '1000001'])
    assert.equal(parseReviewSearch({ page }).page, 1);
  assert.equal(parseReviewSearch({ page: '1000000' }).page, 1000000);
  assert.equal(parseReviewSearch({ status: 'invented' }).status, 'pending');
  assert.equal(parseReviewSearch({ q: ' ' + 'a'.repeat(150) + ' ' }).q.length, 100);
});
test('review links keep search and status across pagination and reset when changing status', () => {
  const search = parseReviewSearch({ q: ' %_ kalem & defter ', status: 'rejected', page: '4' });
  const url = new URL(reviewSearchHref(search, 5), 'https://example.invalid');
  assert.equal(url.pathname, '/admin/yorumlar');
  assert.equal(url.searchParams.get('q'), '%_ kalem & defter');
  assert.equal(url.searchParams.get('status'), 'rejected');
  assert.equal(url.searchParams.get('page'), '5');
  assert.equal(
    new URL(
      reviewSearchHref({ ...search, status: 'approved' }),
      'https://example.invalid',
    ).searchParams.has('page'),
    false,
  );
  assert.deepEqual(reviewSearchArgs(search), {
    p_query: '%_ kalem & defter',
    p_status: 'rejected',
    p_page: 4,
  });
  assert.equal(reviewSearchHref(parseReviewSearch({})), '/admin/yorumlar');
  assert.equal(
    reviewSearchHref(parseReviewSearch({ status: 'all' })),
    '/admin/yorumlar?status=all',
  );
});
