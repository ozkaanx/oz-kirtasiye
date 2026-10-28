import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseInvoiceSearch,
  invoiceSearchArgs,
  invoiceSearchHref,
} from '../src/lib/admin-invoice-search.ts';
test('invoice filters normalize ambiguous input, query length and page bounds', () => {
  const empty = { q: '', status: 'all', from: '', to: '', page: 1 };
  assert.deepEqual(parseInvoiceSearch({}), empty);
  assert.deepEqual(
    parseInvoiceSearch({ q: ['a'], status: ['issued'], from: ['2026-01-01'], page: ['2'] }),
    empty,
  );
  for (const page of ['0', '-1', '1.5', '1e2', '1000001'])
    assert.equal(parseInvoiceSearch({ page }).page, 1);
  assert.equal(parseInvoiceSearch({ page: '1000000' }).page, 1000000);
  assert.equal(parseInvoiceSearch({ status: 'bad' }).status, 'all');
  assert.equal(parseInvoiceSearch({ q: ' ' + 'a'.repeat(150) + ' ' }).q.length, 100);
});
test('invoice dates reject impossible days and normalize reversed ranges', () => {
  for (const from of ['2026-02-29', '2026-13-01', '2026-04-31', '0000-01-01', '2026-1-1'])
    assert.equal(parseInvoiceSearch({ from }).from, '');
  assert.equal(parseInvoiceSearch({ from: '2024-02-29' }).from, '2024-02-29');
  assert.equal(parseInvoiceSearch({ from: '2026-01-03', to: '2026-01-01' }).to, '2026-01-03');
});
test('invoice pagination retains literal query, status and both dates', () => {
  const s = parseInvoiceSearch({
    q: ' %_ firma & müşteri ',
    status: 'issued',
    from: '2026-01-01',
    to: '2026-01-03',
    page: '2',
  });
  const url = new URL(invoiceSearchHref(s, 3), 'https://example.invalid');
  assert.equal(url.pathname, '/admin/faturalar');
  for (const key of ['q', 'status', 'from', 'to']) assert.equal(url.searchParams.get(key), s[key]);
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(
    new URL(invoiceSearchHref(s), 'https://example.invalid').searchParams.has('page'),
    false,
  );
  assert.deepEqual(invoiceSearchArgs(s), {
    p_query: '%_ firma & müşteri',
    p_status: 'issued',
    p_from: '2026-01-01',
    p_to: '2026-01-03',
    p_page: 2,
  });
  assert.equal(invoiceSearchHref(parseInvoiceSearch({})), '/admin/faturalar');
  assert.equal(invoiceSearchArgs(parseInvoiceSearch({})).p_from, null);
});
