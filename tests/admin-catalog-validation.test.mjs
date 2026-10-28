import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateCatalogNumbers,
  validateCatalogImage,
  validateStockAdjustment,
  MAX_STOCK,
  MAX_IMAGE_BYTES,
} from '../src/lib/admin-catalog-validation.ts';
const fields = { price: '19.99', compare: '', stock: '0', threshold: '5' };

test('required numbers cannot silently turn blank or malformed input into zero', () => {
  for (const field of ['price', 'stock', 'threshold']) {
    for (const bad of ['', ' ', '-1', 'Infinity', 'NaN', '0x10', '1e2']) {
      assert.equal(
        validateCatalogNumbers({ ...fields, [field]: bad }, 'product').ok,
        false,
        `${field}: ${bad}`,
      );
    }
  }
  assert.deepEqual(
    validateCatalogNumbers({ price: '0', compare: ' ', stock: '0', threshold: '0' }, 'product'),
    { ok: true, value: { price: 0, compare: null, stock: 0, threshold: 0 } },
  );
});

test('money retains cents, handles decimal comma and rejects silent rounding', () => {
  const result = validateCatalogNumbers(
    { ...fields, price: ' 19,99 ', compare: '25.50' },
    'product',
  );
  assert.deepEqual(result, {
    ok: true,
    value: { price: 19.99, compare: 25.5, stock: 0, threshold: 5 },
  });
  for (const value of ['1.001', '-0.01', '1,000.00', '1.2.3', 'abc']) {
    assert.equal(validateCatalogNumbers({ ...fields, price: value }, 'product').ok, false);
    assert.equal(validateCatalogNumbers({ ...fields, compare: value }, 'product').ok, false);
  }
});

test('product and variant price boundaries follow their different database constraints', () => {
  assert.equal(
    validateCatalogNumbers(
      { ...fields, price: '9999999999.99', compare: '9999999999.99' },
      'product',
    ).ok,
    true,
  );
  assert.equal(validateCatalogNumbers({ ...fields, price: '10000000000' }, 'product').ok, false);
  assert.equal(validateCatalogNumbers({ ...fields, price: '999999.99' }, 'variant').ok, true);
  assert.equal(validateCatalogNumbers({ ...fields, price: '1000000' }, 'variant').ok, false);
  assert.equal(validateCatalogNumbers({ ...fields, compare: '10000000000' }, 'variant').ok, false);
});

test('stock and warning threshold reject fractional and overflowing integers', () => {
  for (const field of ['stock', 'threshold']) {
    assert.equal(
      validateCatalogNumbers({ ...fields, [field]: String(MAX_STOCK) }, 'product').ok,
      true,
    );
    for (const value of [String(MAX_STOCK + 1), '1.5', '9007199254740993'])
      assert.equal(validateCatalogNumbers({ ...fields, [field]: value }, 'product').ok, false);
  }
});

test('optional image accepts supported formats through 5 MiB; empty, oversized and unsupported files fail', () => {
  assert.equal(validateCatalogImage(null), null);
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.equal(validateCatalogImage({ type, size: MAX_IMAGE_BYTES }), null);
    assert.equal(validateCatalogImage({ type, size: MAX_IMAGE_BYTES + 1 }) !== null, true);
    assert.equal(validateCatalogImage({ type, size: 0 }) !== null, true);
  }
  for (const type of ['image/svg+xml', 'image/gif', 'text/html', ''])
    assert.equal(validateCatalogImage({ type, size: 123 }) !== null, true);
});

test('stock changes enforce RPC amount limits and signed direction', () => {
  assert.deepEqual(validateStockAdjustment('100000', 0, 'increase'), {
    ok: true,
    value: { amount: 100000, change: 100000, resultingStock: 100000 },
  });
  assert.deepEqual(validateStockAdjustment('5', 5, 'decrease'), {
    ok: true,
    value: { amount: 5, change: -5, resultingStock: 0 },
  });
  for (const value of ['', ' ', '0', '-1', '1.5', '100001', '1e2'])
    assert.equal(validateStockAdjustment(value, 10, 'increase').ok, false);
});

test('stock subtraction cannot go negative and addition cannot overflow a database integer', () => {
  assert.equal(validateStockAdjustment('6', 5, 'decrease').ok, false);
  assert.equal(validateStockAdjustment('1', MAX_STOCK, 'increase').ok, false);
  assert.equal(validateStockAdjustment('1', MAX_STOCK - 1, 'increase').ok, true);
  for (const current of [-1, NaN, Infinity, 1.5, MAX_STOCK + 1])
    assert.equal(validateStockAdjustment('1', current, 'increase').ok, false);
});
