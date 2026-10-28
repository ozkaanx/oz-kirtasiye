import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseReturnSearch,
  returnSearchArgs,
  returnSearchHref,
} from '../src/lib/admin-return-search.ts';
test('return search rejects ambiguous filters and bounds page/query input', () => {
  const empty = { q: '', status: 'all', kind: 'all', page: 1 };
  assert.deepEqual(parseReturnSearch({}), empty);
  assert.deepEqual(
    parseReturnSearch({ q: ['a'], status: ['requested'], kind: ['return'], page: ['2'] }),
    empty,
  );
  for (const page of ['0', '-1', '1.5', '1e2', '1000001'])
    assert.equal(parseReturnSearch({ page }).page, 1);
  assert.equal(parseReturnSearch({ page: '1000000' }).page, 1000000);
  assert.equal(parseReturnSearch({ status: 'bad', kind: 'bad' }).status, 'all');
  assert.equal(parseReturnSearch({ kind: 'bad' }).kind, 'all');
  assert.equal(parseReturnSearch({ q: ' ' + 'a'.repeat(150) + ' ' }).q.length, 100);
});
test('return pagination preserves literal query, request status and kind', () => {
  const s = parseReturnSearch({
    q: ' %_ kalem & müşteri ',
    status: 'received',
    kind: 'exchange',
    page: '2',
  });
  const url = new URL(returnSearchHref(s, 3), 'https://example.invalid');
  assert.equal(url.pathname, '/admin/iadeler');
  for (const key of ['q', 'status', 'kind']) assert.equal(url.searchParams.get(key), s[key]);
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(
    new URL(returnSearchHref(s), 'https://example.invalid').searchParams.has('page'),
    false,
  );
  assert.deepEqual(returnSearchArgs(s), {
    p_query: '%_ kalem & müşteri',
    p_status: 'received',
    p_kind: 'exchange',
    p_page: 2,
  });
  assert.equal(returnSearchHref(parseReturnSearch({})), '/admin/iadeler');
});
