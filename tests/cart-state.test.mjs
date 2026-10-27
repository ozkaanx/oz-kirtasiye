import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cartReducer, initialCartState } from '../src/lib/cart-state.ts';
const productId = '10000000-0000-0000-0000-000000000001';
const variantId = '20000000-0000-0000-0000-000000000001';
test('addition updates the basket and success feedback together without mutating previous state', () => {
  const next = cartReducer(initialCartState, { type: 'add', productId, variantId, amount: 2 });
  assert.equal(next.lines[0].quantity, 2);
  assert.equal(next.lines[0].variantId, variantId);
  assert.deepEqual(next.feedback, { kind: 'success', quantity: 2 });
  assert.deepEqual(initialCartState.lines, []);
  const more = cartReducer(next, { type: 'add', productId, variantId, amount: 3 });
  assert.equal(more.lines[0].quantity, 5);
  assert.equal(more.lines.length, 1);
  assert.deepEqual(more.feedback, { kind: 'success', quantity: 3 });
});
test('full basket rejects a new line but permits an existing variant and never reports false success', () => {
  const lines = Array.from({ length: 20 }, (_, n) => ({
    productId: `10000000-0000-0000-0000-${String(n + 1).padStart(12, '0')}`,
    variantId: null,
    quantity: 1,
  }));
  const full = { lines, feedback: null };
  const rejected = cartReducer(full, { type: 'add', productId, variantId, amount: 1 });
  assert.equal(rejected.feedback.kind, 'error');
  assert.equal(rejected.lines, lines);
  const updated = cartReducer(full, { type: 'add', productId, amount: 1 });
  assert.equal(updated.lines[0].quantity, 2);
  assert.equal(updated.feedback.kind, 'success');
});
test('quantity cap reports only the amount actually added; no-op does not report success', () => {
  const state = { lines: [{ productId, quantity: 98 }], feedback: null };
  const capped = cartReducer(state, { type: 'add', productId, amount: 5 });
  assert.equal(capped.lines[0].quantity, 99);
  assert.deepEqual(capped.feedback, { kind: 'success', quantity: 1 });
  assert.equal(cartReducer(capped, { type: 'add', productId, amount: 1 }).feedback.kind, 'error');
});
test('invalid input cannot change cart or trigger feedback; dismiss preserves the basket', () => {
  for (const action of [
    { type: 'add', productId: 'bad', amount: 1 },
    { type: 'add', productId, amount: 0 },
    { type: 'add', productId, variantId: 'bad', amount: 1 },
    { type: 'add', productId, amount: 1.5 },
  ])
    assert.equal(cartReducer(initialCartState, action), initialCartState);
  const added = cartReducer(initialCartState, { type: 'add', productId, amount: 1 });
  const dismissed = cartReducer(added, { type: 'dismiss' });
  assert.equal(dismissed.lines, added.lines);
  assert.equal(dismissed.feedback, null);
});
test('hydration and quantity/removal/clear operations retain their previous basket semantics', () => {
  let state = cartReducer(initialCartState, {
    type: 'hydrate',
    lines: [{ productId, variantId, quantity: 4 }],
  });
  assert.equal(state.feedback, null);
  state = cartReducer(state, { type: 'quantity', productId, variantId, quantity: 7 });
  assert.equal(state.lines[0].quantity, 7);
  state = cartReducer(state, { type: 'quantity', productId, variantId, quantity: 0 });
  assert.equal(state.lines.length, 0);
  state = cartReducer(state, { type: 'add', productId, amount: 1 });
  assert.equal(cartReducer(state, { type: 'remove', productId }).lines.length, 0);
  assert.deepEqual(cartReducer(state, { type: 'clear' }), initialCartState);
});
