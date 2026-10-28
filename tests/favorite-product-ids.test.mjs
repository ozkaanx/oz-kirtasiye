import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_FAVORITE_IDS, parseFavoriteIds } from '../src/lib/favorite-product-ids.ts';

const a = '10000000-0000-0000-0000-000000000001';
const b = '10000000-0000-0000-0000-000000000002';

test('favorite IDs remain bounded, stable, unique and normalized', () => {
  assert.equal(MAX_FAVORITE_IDS, 100);
  assert.deepEqual(parseFavoriteIds([a, b, a.toUpperCase()]), [a, b]);
  assert.deepEqual(parseFavoriteIds([]), []);
  const ids = Array.from({ length: 100 }, (_, n) =>
    '10000000-0000-0000-0000-' + String(n + 1).padStart(12, '0'));
  assert.equal(parseFavoriteIds(ids)?.length, 100);
});

test('reject invalid or oversized favorite requests rather than falling back to all products', () => {
  for (const value of [null, undefined, {}, 'x', [0], ['bad'], [a, null], Array(101).fill(a)]) {
    assert.equal(parseFavoriteIds(value), null);
  }
});
