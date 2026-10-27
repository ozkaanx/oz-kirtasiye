import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseOrderSearch,
  orderSearchArgs,
  orderSearchHref,
  orderCursor,
  parseOrderCursor,
} from '../src/lib/admin-order-search.ts';
import { operationTrace } from '../src/lib/operation-trace.ts';
import { handleCouponQuote } from '../src/lib/coupon-quote-handler.ts';
import { handleAdminOrderAction } from '../src/lib/admin-order-action-handler.ts';
const id = '72000000-0000-0000-0000-000000000001';
const cursor = `2026-01-02T12:00:00.123456+00:00|${id}`;
test('search normalization rejects arrays, invalid dates and filters; clamps inverted dates', () => {
  const search = parseOrderSearch({
    q: ['ignored'],
    status: 'forged',
    delivery: 'random',
    from: '2026-02-30',
    to: 'bad',
    after: 'bad',
  });
  assert.deepEqual(search, {
    q: '',
    status: 'all',
    delivery: 'all',
    from: '',
    to: '',
    after: '',
    before: '',
  });
  assert.equal(parseOrderSearch({ from: '2026-01-03', to: '2026-01-01' }).to, '2026-01-03');
  assert.equal(parseOrderSearch({ q: 'x'.repeat(101) }).q.length, 100);
});
test('cursor preserves database microseconds, uses a stable tie breaker and survives URL encoding', () => {
  const search = parseOrderSearch({ q: 'İpek %_', status: 'new', after: cursor, before: cursor });
  const args = orderSearchArgs(search);
  assert.equal(args.p_cursor_time, '2026-01-02T12:00:00.123456+00:00');
  assert.equal(args.p_cursor_id, id);
  assert.equal(search.before, '');
  assert.equal(orderCursor({ created_at: args.p_cursor_time, id }), cursor);
  const url = new URL(
    orderSearchHref(search, { direction: 'before', value: cursor }),
    'https://shop.example',
  );
  assert.equal(url.searchParams.get('q'), 'İpek %_');
  assert.equal(url.searchParams.get('before'), cursor);
  assert.equal(url.searchParams.has('after'), false);
  assert.equal(
    new URL(orderSearchHref(search), 'https://shop.example').searchParams.has('after'),
    false,
  );
  assert.equal(parseOrderCursor('2026-01-02|' + id), null);
});
test('operational trace is unique, structured and drops unsafe error codes', () => {
  const lines = [];
  const trace = operationTrace('admin_order_search', (line) => lines.push(JSON.parse(line)));
  trace.error('database_error', 'PGRST202');
  trace.error('unexpected', 'phone=05551234567\nsecret');
  assert.match(trace.requestId, /^[0-9a-f-]{36}$/);
  assert.notEqual(trace.requestId, operationTrace('coupon_quote').requestId);
  assert.equal(lines[0].requestId, trace.requestId);
  assert.equal(lines[0].code, 'PGRST202');
  assert.equal(lines[1].code, undefined);
  assert.equal(JSON.stringify(lines).includes('05551234567'), false);
  assert.equal(lines[0].durationMs >= 0, true);
});
function req(body, url = '/api/coupon-quote', headers = {}) {
  return new Request('https://shop.example' + url, {
    method: 'POST',
    headers: { origin: 'https://shop.example', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
function coupon(overrides = {}) {
  const calls = [];
  const errors = [];
  return {
    calls,
    errors,
    deps: {
      configured: true,
      requestId: id,
      getUserId: async () => null,
      quote: async (args) => {
        calls.push(args);
        return {
          data: [
            {
              subtotal: 100,
              discount_amount: 10,
              shipping_fee: 20,
              total: 110,
              code: 'TEST',
              campaign_name: null,
            },
          ],
          error: null,
        };
      },
      onError: (...args) => errors.push(args),
      ...overrides,
    },
  };
}
const basket = {
  items: [{ productId: id, quantity: 1 }],
  deliveryMethod: 'shipping',
  couponCode: 'TEST',
  customerUserId: id,
};
test('coupon quote trusts session identity and sends a support trace without caching', async () => {
  const c = coupon();
  const response = await handleCouponQuote(req(basket), c.deps);
  assert.equal(response.status, 200);
  assert.equal(c.calls[0].p_customer_user_id, null);
  assert.equal(c.calls[0].p_phone, null);
  assert.equal((await response.json()).total, 110);
  assert.equal(response.headers.get('x-request-id'), id);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('coupon business errors stay 400; database and authentication failures become tracked 503s', async () => {
  for (const code of ['22023', 'PGRST202']) {
    const c = coupon({
      quote: async () => ({ data: null, error: { code, message: 'internal secret detail' } }),
    });
    const response = await handleCouponQuote(req(basket), c.deps);
    const body = await response.json();
    assert.equal(response.status, code === '22023' ? 400 : 503);
    if (code !== '22023') {
      assert.equal(body.message.includes('internal secret'), false);
      assert.equal(body.message.includes(id), true);
      assert.deepEqual(c.errors, [['database_error', code]]);
    }
  }
  const c = coupon({
    getUserId: async () => {
      throw new Error('auth secret');
    },
  });
  assert.equal((await handleCouponQuote(req(basket), c.deps)).status, 503);
  assert.equal(c.calls.length, 0);
  assert.deepEqual(c.errors, [['unexpected']]);
});
test('coupon rejects malformed/chunked oversized bodies and origin before calling DB', async () => {
  const c = coupon();
  assert.equal(
    (await handleCouponQuote(req(basket, undefined, { origin: 'https://evil.example' }), c.deps))
      .status,
    403,
  );
  assert.equal(
    (await handleCouponQuote(req({ ...basket, extra: 'ş'.repeat(6000) }), c.deps)).status,
    413,
  );
  const bad = new Request('https://shop.example/api/coupon-quote', {
    method: 'POST',
    headers: { origin: 'https://shop.example', 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal((await handleCouponQuote(bad, c.deps)).status, 400);
  assert.equal(c.calls.length, 0);
  assert.equal(c.errors.length, 0);
});
const actionBody = {
  orderId: id,
  action: 'ship',
  carrier: ' Cargo ',
  trackingNumber: ' 123 ',
  cancelReason: 'ignore',
};
function admin(overrides = {}) {
  const calls = [];
  const errors = [];
  return {
    calls,
    errors,
    deps: {
      requestId: id,
      authorize: async () => 'admin',
      execute: async (input) => {
        calls.push(input);
        return { error: null };
      },
      onError: (...args) => errors.push(args),
      ...overrides,
    },
  };
}
test('admin mutation rejects anonymous/non-admin/foreign-origin requests without changing orders', async () => {
  for (const [access, status] of [
    ['unauthenticated', 401],
    ['forbidden', 403],
  ]) {
    const a = admin({ authorize: async () => access });
    assert.equal((await handleAdminOrderAction(req(actionBody), a.deps)).status, status);
    assert.equal(a.calls.length, 0);
  }
  const a = admin();
  assert.equal(
    (
      await handleAdminOrderAction(
        req(actionBody, undefined, { origin: 'https://evil.example' }),
        a.deps,
      )
    ).status,
    403,
  );
  assert.equal(a.calls.length, 0);
});
test('admin mutations validate inputs and map only fields relevant to each action', async () => {
  const a = admin();
  assert.equal((await handleAdminOrderAction(req(actionBody), a.deps)).status, 200);
  assert.deepEqual(a.calls[0], {
    orderId: id,
    action: 'ship',
    carrier: 'Cargo',
    trackingNumber: '123',
    reason: null,
  });
  await handleAdminOrderAction(req({ ...actionBody, action: 'pickup_collect' }), a.deps);
  assert.equal(a.calls[1].carrier, null);
  assert.equal(
    (await handleAdminOrderAction(req({ ...actionBody, action: 'forged' }), a.deps)).status,
    400,
  );
  assert.equal(a.calls.length, 2);
});
test('admin mutation errors preserve validation messages but hide infrastructure details', async () => {
  for (const [code, status] of [
    ['22023', 400],
    ['42501', 403],
    ['XX000', 503],
  ]) {
    const a = admin({
      execute: async () => ({ error: { code, message: 'private database detail' } }),
    });
    const response = await handleAdminOrderAction(req(actionBody), a.deps);
    assert.equal(response.status, status);
    const body = await response.json();
    if (code !== '22023') assert.equal(body.message.includes('private database detail'), false);
    if (status === 503) {
      assert.equal(body.message.includes(id), true);
      assert.deepEqual(a.errors, [['database_error', code]]);
    }
  }
});
