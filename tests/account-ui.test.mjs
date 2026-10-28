import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseAccountTab,
  orderStatusPresentation,
  paymentStatusPresentation,
} from '../src/lib/account-ui.ts';

test('account deep links accept only supported tabs', () => {
  assert.equal(parseAccountTab('addresses'), 'addresses');
  assert.equal(parseAccountTab('orders'), 'orders');
  for (const value of ['profile', 'admin', '', undefined, ['orders']]) {
    assert.equal(parseAccountTab(value), 'overview');
  }
});

test('new payment states have truthful, customer-friendly labels and tones', () => {
  assert.deepEqual(orderStatusPresentation('awaiting_payment'), {
    label: 'Ödeme bekleniyor', tone: 'warning',
  });
  assert.deepEqual(orderStatusPresentation('paid'), {
    label: 'Ödeme alındı', tone: 'success',
  });
  assert.equal(paymentStatusPresentation('paid').label, 'Ödeme alındı');
  assert.equal(paymentStatusPresentation('pending').label, 'Ödeme bekleniyor');
  assert.equal(paymentStatusPresentation('requires_review').tone, 'warning');
  assert.equal(paymentStatusPresentation('failed').tone, 'danger');
  assert.equal(paymentStatusPresentation('expired').tone, 'danger');
  assert.equal(paymentStatusPresentation('not_collected').label, 'Ödeme henüz alınmadı');
});

test('unknown backend states are not falsely presented as a successful payment', () => {
  assert.equal(orderStatusPresentation('some_new_state').tone, 'neutral');
  assert.equal(paymentStatusPresentation('some_new_state').tone, 'neutral');
  assert.equal(paymentStatusPresentation('some_new_state').label, 'Ödeme durumu doğrulanamadı');
});
