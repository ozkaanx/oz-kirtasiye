import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  customerPage,
  customerOrdersHref,
  isCustomerId,
} from '../src/lib/admin-customer-catalog.ts';
const id = 'c1000000-0000-0000-0000-000000000002';
test('customer page rejects invalid/ambiguous values and bounds history requests', () => {
  assert.equal(customerPage({}), 1);
  assert.equal(customerPage({ page: ['2', '3'] }), 1);
  for (const page of ['0', '-1', '1.5', '1e2', '1000001', 'abc'])
    assert.equal(customerPage({ page }), 1);
  assert.equal(customerPage({ page: '2' }), 2);
  assert.equal(customerPage({ page: '1000000' }), 1000000);
});
test('customer links retain identity and isolate it from query/path syntax', () => {
  assert.equal(isCustomerId(id), true);
  assert.equal(isCustomerId(id.toUpperCase()), true);
  for (const bad of ['', '../../admin', 'wrong-id', id + '?page=2'])
    assert.equal(isCustomerId(bad), false);
  assert.equal(customerOrdersHref(id), `/admin/musteriler/${id}`);
  assert.equal(customerOrdersHref(id, 3), `/admin/musteriler/${id}?page=3`);
  assert.equal(customerOrdersHref('a/b?x=1', 2), '/admin/musteriler/a%2Fb%3Fx%3D1?page=2');
});
