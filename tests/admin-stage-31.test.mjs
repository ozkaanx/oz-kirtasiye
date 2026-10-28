import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../src/lib/admin-orders.ts';
import { parseOrderSearch, orderSearchArgs, orderSearchHref } from '../src/lib/admin-order-search.ts';
import { ADMIN_MENU_GROUPS, getActiveAdminGroup } from '../src/lib/admin-navigation.ts';
import { selectCriticalStockProducts } from '../src/lib/admin-stock-alerts.ts';

test('payment-related order statuses are distinct and retain no payment action side effects', () => {
  assert.equal(ORDER_STATUS_LABELS.awaiting_payment, 'Ödeme bekleniyor');
  assert.match(ORDER_STATUS_LABELS.paid, /Ödeme alındı/);
  assert.equal(PAYMENT_STATUS_LABELS.not_collected, 'Tahsil edilmedi');
  assert.equal(PAYMENT_STATUS_LABELS.pending, 'Ödeme bekleniyor');
  assert.equal(PAYMENT_STATUS_LABELS.paid, 'Ödeme alındı');
  assert.equal(PAYMENT_STATUS_LABELS.failed, 'Ödeme başarısız');
  assert.equal(PAYMENT_STATUS_LABELS.expired, 'Ödeme süresi doldu');
  assert.equal(PAYMENT_STATUS_LABELS.requires_review, 'Ödeme inceleniyor');
});

test('admin order filter preserves new statuses and rejects unexpected values', () => {
  for (const status of ['awaiting_payment', 'paid', 'processing', 'cancelled']) {
    const parsed = parseOrderSearch({ status });
    assert.equal(parsed.status, status);
    assert.equal(orderSearchArgs(parsed).p_status, status);
    assert.equal(orderSearchHref(parsed), `/admin/siparisler?status=${status}`);
  }
  assert.equal(parseOrderSearch({ status: 'faked_paid' }).status, 'all');
});

test('existing product review moderation appears in Catalog category', () => {
  const catalog = ADMIN_MENU_GROUPS.find((group) => group.id === 'catalog');
  assert.ok(catalog);
  assert.ok(catalog.items.some((item) => item.href === '/admin/yorumlar'));
  assert.equal(getActiveAdminGroup('/admin/yorumlar'), 'catalog');
});

const entry = (id, stock, threshold = 5) => ({
  id, name: `Product ${id}`, slug: `product-${id}`,
  stock_quantity: stock, low_stock_threshold: threshold,
});

test('dashboard shows out of stock before low stock, including variant-aggregated stock', () => {
  const out = { rows: [entry('variant-no-stock', 0), entry('regular-out', 0)] };
  const low = { rows: [entry('variant-low', 1), entry('regular-low', 3)] };
  assert.deepEqual(
    selectCriticalStockProducts(out, low, 3)?.map((row) => [row.id, row.stock]),
    [['variant-no-stock', 0], ['regular-out', 0], ['variant-low', 1]],
  );
});

test('dashboard does not silently claim an empty critical stock list when RPC response is invalid', () => {
  assert.equal(selectCriticalStockProducts(null, { rows: [] }), null);
  assert.equal(selectCriticalStockProducts({ rows: [] }, { broken: true }), null);
  assert.equal(selectCriticalStockProducts({ rows: [entry('bad', 4)] }, { rows: [] }), null);
  assert.equal(selectCriticalStockProducts({ rows: [] }, { rows: [entry('bad', 0)] }), null);
  assert.equal(selectCriticalStockProducts({ rows: [] }, { rows: [] }, 0), null);
});
