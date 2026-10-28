import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseProductSearch,
  productSearchHref,
  productSearchArgs,
} from '../src/lib/admin-product-search.ts';
const id = '10000000-0000-0000-0000-000000000001';
test('product search rejects ambiguous and malformed parameters and bounds pages', () => {
  const empty = parseProductSearch({});
  assert.equal(empty.page, 1);
  for (const page of ['0', '-1', '1.5', '1e2', '1000001', 'garbage'])
    assert.equal(parseProductSearch({ page }).page, 1);
  assert.equal(parseProductSearch({ page: '1000000' }).page, 1000000);
  assert.deepEqual(
    parseProductSearch({
      q: ['a', 'b'],
      category: 'x',
      sort: 'rawSQL',
      stock: 'wrong',
      visibility: 'wrong',
      page: ['2'],
    }),
    empty,
  );
  assert.equal(parseProductSearch({ q: ' ' + 'a'.repeat(120) + ' ' }).q.length, 100);
});
test('product filter links retain every filter and encode literal search text', () => {
  const s = parseProductSearch({
    q: ' %_ kalem & defter ',
    category: id,
    visibility: 'inactive',
    stock: 'low',
    sort: 'stockDesc',
    page: '2',
  });
  const href = productSearchHref(s, 3);
  const url = new URL(href, 'https://example.invalid');
  assert.equal(url.pathname, '/admin/urunler');
  assert.equal(url.searchParams.get('q'), '%_ kalem & defter');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(url.searchParams.get('category'), id);
  assert.equal(url.searchParams.get('visibility'), 'inactive');
  assert.equal(url.searchParams.get('stock'), 'low');
  assert.equal(url.searchParams.get('sort'), 'stockDesc');
  assert.equal(
    new URL(productSearchHref(s, 1), 'https://example.invalid').searchParams.has('page'),
    false,
  );
  assert.deepEqual(productSearchArgs(s), {
    p_query: '%_ kalem & defter',
    p_category: id,
    p_visibility: 'inactive',
    p_stock: 'low',
    p_sort: 'stockDesc',
    p_page: 2,
  });
  assert.equal(productSearchHref(parseProductSearch({}), 1), '/admin/urunler');
  assert.equal(productSearchArgs(parseProductSearch({})).p_category, null);
});
