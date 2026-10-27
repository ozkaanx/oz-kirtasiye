import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryQuote, cartPricing } from '../src/lib/delivery.ts';
import { resolveDeliveryFields } from '../src/lib/checkout-form.ts';

const settings = {
  shipping_enabled: true,
  pickup_enabled: true,
  shipping_flat_fee: 20,
  free_shipping_threshold: 100,
  registered_address: 'Test store address',
  pickup_instructions: null,
};
const none = { quote: null, loading: false, error: '' };
test('discounted subtotal governs both shipping estimate and remaining threshold', () => {
  const pricing = cartPricing(
    settings,
    100,
    'shipping',
    { ...none, quote: { subtotal: 100, discountAmount: 20, shippingFee: 20, total: 100 } },
    'TEST',
  );
  assert.equal(pricing.netSubtotal, 80);
  assert.equal(pricing.shippingFee, 20);
  assert.equal(pricing.delivery.fee, 20);
  assert.equal(pricing.freeShippingRemaining, 20);
  assert.equal(pricing.total, 100);
  assert.equal(pricing.couponBlocked, false);
});
test('server quote takes precedence over stale browser product prices', () => {
  const pricing = cartPricing(
    settings,
    80,
    'shipping',
    { ...none, quote: { subtotal: 150, discountAmount: 20, shippingFee: 0, total: 130 } },
    '',
  );
  assert.equal(pricing.subtotal, 150);
  assert.equal(pricing.netSubtotal, 130);
  assert.equal(pricing.total, 130);
  assert.equal(pricing.freeShippingRemaining, null);
});
test('cent arithmetic handles threshold equality and fractional cart sums', () => {
  const quote = deliveryQuote({ ...settings, free_shipping_threshold: 0.3 }, 0.1 + 0.2, 'shipping');
  assert.equal(quote.fee, 0);
  assert.equal(quote.total, 0.3);
  assert.equal(
    deliveryQuote(
      { ...settings, free_shipping_threshold: null, shipping_flat_fee: 0.2 },
      0.1,
      'shipping',
    ).total,
    0.3,
  );
});
test('pickup is free; a disabled method never displays an obsolete server total', () => {
  assert.equal(deliveryQuote(settings, 90, 'pickup').total, 90);
  const pricing = cartPricing(
    { ...settings, shipping_enabled: false },
    100,
    'shipping',
    { ...none, quote: { subtotal: 100, discountAmount: 0, shippingFee: 0, total: 100 } },
    '',
  );
  assert.equal(pricing.total, null);
  assert.equal(pricing.shippingFee, null);
});
test('pending/failed coupons block submission while no-coupon estimates remain usable', () => {
  assert.equal(
    cartPricing(settings, 80, 'shipping', { ...none, loading: true }, 'CODE').couponBlocked,
    true,
  );
  assert.equal(
    cartPricing(settings, 80, 'shipping', { ...none, error: 'unavailable' }, 'CODE').couponBlocked,
    true,
  );
  const estimate = cartPricing(settings, 80, 'shipping', { ...none, error: 'unavailable' }, '');
  assert.equal(estimate.couponBlocked, false);
  assert.equal(estimate.total, 100);
});
test('invalid server totals cannot replace the estimate or validate a coupon', () => {
  const pricing = cartPricing(
    settings,
    80,
    'shipping',
    { ...none, quote: { subtotal: 80, discountAmount: 100, shippingFee: 0, total: -20 } },
    'CODE',
  );
  assert.equal(pricing.fromServer, false);
  assert.equal(pricing.total, 100);
  assert.equal(pricing.couponBlocked, true);
});
test('invalid settings and non-finite amounts do not produce payable estimates', () => {
  for (const subtotal of [-1, NaN, Infinity])
    assert.equal(deliveryQuote(settings, subtotal, 'shipping').available, false);
  assert.equal(
    deliveryQuote({ ...settings, shipping_flat_fee: null }, 100, 'shipping').available,
    false,
  );
  assert.equal(
    deliveryQuote({ ...settings, shipping_flat_fee: -1 }, 100, 'shipping').available,
    false,
  );
});
test('saved shipping address is authoritative over hidden manual fields', () => {
  const fields = {
    customerName: 'Manual name',
    phone: '05551111111',
    city: 'Manual city',
    district: 'Manual district',
    address: 'Manual address',
    note: 'Keep note',
  };
  const address = {
    recipient_name: 'Saved name',
    phone: '05552222222',
    city: 'Saved city',
    district: 'Saved district',
    address: 'Saved address',
  };
  assert.deepEqual(resolveDeliveryFields(fields, address, 'shipping', true), {
    customerName: 'Saved name',
    phone: '05552222222',
    city: 'Saved city',
    district: 'Saved district',
    address: 'Saved address',
    note: 'Keep note',
  });
  assert.equal(resolveDeliveryFields(fields, address, 'pickup', true), fields);
  assert.equal(resolveDeliveryFields(fields, address, 'shipping', false), fields);
});
