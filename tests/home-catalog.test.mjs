import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  homeCatalogQueries,
  homeCatalogProductIds,
  projectHomeCatalog,
} from '../src/lib/home-catalog-helpers.ts';

const product = (id) => ({
  id, slug: id, name: id, description: null, category_id: null,
  price: 100, compare_at_price: null, stock_quantity: 3,
  has_variants: false, variants: [], galleryUrls: [], imageUrl: null,
  promotion: null, campaignNotice: null, is_featured: false,
  created_at: '2026-10-28T00:00:00Z',
});
const match = (id) => ({
  product_id: id, variant_id: null, matched_stock: 3,
  display_price: 100, total_count: 5000,
});

test('homepage requests only eight products for each of six visible categories, plus four newest', () => {
  const categories = Array.from({ length: 15 }, (_, n) => ({
    slug: 'category-' + n, parent_id: n === 0 ? 'root' : null,
  }));
  const queries = homeCatalogQueries(categories);
  assert.equal(queries.length, 8);
  assert.deepEqual(queries.map((query) => query.key), [
    'all', 'category-1', 'category-2', 'category-3',
    'category-4', 'category-5', 'category-6', 'newest',
  ]);
  assert.ok(queries.slice(0, -1).every((query) => query.limit === 8 && query.sort === 'featured'));
  assert.equal(queries.at(-1).limit, 4);
  assert.equal(queries.at(-1).sort, 'newest');
});

test('product IDs are deduplicated across all homepage sections, not capped at the first 500', () => {
  const pages = [[match('item-1500'), match('item-2')], [match('item-1500'), match('item-999')]];
  assert.deepEqual(homeCatalogProductIds(pages), ['item-1500', 'item-2', 'item-999']);
});

test('homepage preserves category ordering and latest product list', () => {
  const queries = homeCatalogQueries([{ slug: 'toys', parent_id: null }]);
  const pages = [
    [match('b'), match('a')],
    [match('a')],
    [match('c')],
  ];
  const displayed = projectHomeCatalog(queries, pages, [product('a'), product('b'), product('c')]);
  assert.deepEqual(displayed.featuredByCategory.all.map((item) => item.id), ['b', 'a']);
  assert.deepEqual(displayed.featuredByCategory.toys.map((item) => item.id), ['a']);
  assert.deepEqual(displayed.newestProducts.map((item) => item.id), ['c']);
});

test('missing/unpublished homepage items disappear without altering other sections', () => {
  const queries = homeCatalogQueries([]);
  const displayed = projectHomeCatalog(queries, [[match('unpublished')], [match('active')]], [product('active')]);
  assert.deepEqual(displayed.featuredByCategory.all, []);
  assert.deepEqual(displayed.newestProducts.map((item) => item.id), ['active']);
});
