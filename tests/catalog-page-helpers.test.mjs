import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATALOG_PAGE_SIZE,
  parseCatalogPage,
  catalogPageArgs,
  catalogPageMeta,
  projectCatalogPage,
} from '../src/lib/catalog-page-helpers.ts';

const filters = {
  category: 'kalem', q: '  mavi kalem  ', sort: 'price-asc',
  min: '10', max: '250', color: 'Mavi', size: 'M', stock: true, campaign: false,
};
const match = (product_id, variant_id = null, matched_stock = 3, total_count = 50) => ({
  product_id, variant_id, matched_stock, total_count, display_price: '75.00',
});
const variant = (id, price, extra = {}) => ({
  id, color: 'Mavi', size: 'M', price, compare_at_price: 120,
  stock_quantity: 3, imageUrl: null, is_active: true,
  promotion: null, campaignNotice: null, ...extra,
});
const product = (id, variants = []) => ({
  id, slug: 'test-' + id, name: 'Test', description: null, category_id: null,
  price: 90, compare_at_price: null, stock_quantity: 5,
  has_variants: !!variants.length, variants, galleryUrls: ['fallback-image'],
  imageUrl: 'original-image', promotion: null, campaignNotice: null,
  is_featured: false, created_at: '2026-10-28T00:00:00Z',
});

test('URL page parsing handles invalid, zero, oversized and valid pages', () => {
  assert.equal(CATALOG_PAGE_SIZE, 24);
  for (const value of [null, '', '0', '-1', '1.5', 'abc', '0002', '1000000']) {
    assert.equal(parseCatalogPage(value), 1, String(value));
  }
  assert.equal(parseCatalogPage('2'), 2);
  assert.equal(parseCatalogPage('100000'), 100000);
});

test('server RPC receives normalized filters and a fixed page size', () => {
  assert.deepEqual(catalogPageArgs(filters, 3), {
    p_category: 'kalem', p_q: 'mavi kalem', p_sort: 'price-asc',
    p_min: 10, p_max: 250, p_color: 'Mavi', p_size: 'M',
    p_stock: true, p_campaign: false, p_page: 3, p_page_size: 24,
  });
  const emptyMoney = catalogPageArgs({ ...filters, min: '', max: '' }, 1);
  assert.equal(emptyMoney.p_min, null);
  assert.equal(emptyMoney.p_max, null);
});

test('SQL count remains available on empty pages and stale offsets clamp', () => {
  assert.deepEqual(catalogPageMeta([match(null, null, null, '1001')], 99), {
    total: 1001, pageCount: 42, currentPage: 42,
  });
  assert.deepEqual(catalogPageMeta([match(null, null, null, 0)], 100), {
    total: 0, pageCount: 1, currentPage: 1,
  });
});

test('projection preserves SQL order and exactly the qualifying variant and price', () => {
  const a = product('a', [
    variant('wrong', 10, { color: 'Kırmızı', imageUrl: 'wrong-image' }),
    variant('right', 75, { imageUrl: 'right-image' }),
  ]);
  const b = product('b');
  const shown = projectCatalogPage(
    [match('b', null, 2), match('a', 'right', 7)],
    [a, b],
  );
  assert.deepEqual(shown.map((x) => x.id), ['b', 'a']);
  assert.equal(shown[0].stock_quantity, 2);
  assert.equal(shown[1].filterVariantId, 'right');
  assert.equal(shown[1].price, 75);
  assert.equal(shown[1].imageUrl, 'right-image');
  assert.equal(shown[1].stock_quantity, 7);
  assert.equal(shown[1].compare_at_price, 120);
});

test('projection fails closed for unpublished products and variants', () => {
  const a = product('a', [variant('live', 50)]);
  assert.deepEqual(projectCatalogPage([match('missing')], [a]), []);
  assert.deepEqual(projectCatalogPage([match('a', 'unpublished')], [a]), []);
  assert.equal(projectCatalogPage([match('a', 'live')], [a])[0].imageUrl, 'fallback-image');
});
