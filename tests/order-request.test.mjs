import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleOrderRequest, orderRequestIdentity } from '../src/lib/order-request-handler.ts';
import { checkoutAttempt, clearCheckoutAttempt } from '../src/lib/checkout-attempt.ts';

const key = '50000000-0000-0000-0000-000000000001';
const userId = '10000000-0000-0000-0000-000000000001';
const body = {
  customerName: 'Test buyer',
  phone: '05551112222',
  city: 'Istanbul',
  district: 'Bagcilar',
  address: 'Test address 123',
  note: '',
  items: [{ productId: '20000000-0000-0000-0000-000000000001', quantity: 1 }],
  deliveryMethod: 'shipping',
  preInformationRead: true,
  privacyNoticeRead: true,
  noticeVersion: 'v-test',
  billing: {
    buyerType: 'individual',
    recipientName: 'Test buyer',
    city: 'Istanbul',
    district: 'Bagcilar',
    address: 'Test address 123',
  },
};
const order = {
  id: key,
  reference: 'OZ-TEST',
  subtotal: '100',
  total: '120',
  discount_amount: '0',
  shipping_fee: '20',
  delivery_method: 'shipping',
  code: null,
  campaign_name: null,
  replayed: false,
};
function request(payload = body, headers = {}) {
  return new Request('https://shop.example/api/order-requests', {
    method: 'POST',
    headers: {
      origin: 'https://shop.example',
      'content-type': 'application/json',
      'idempotency-key': key,
      ...headers,
    },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}
function dependencies(overrides = {}) {
  const calls = { limits: [], submissions: [], errors: [] };
  const deps = {
    enabled: true,
    configured: true,
    secret: 'test-only-secret',
    noticeVersion: 'v-test',
    trustedIpHeader: null,
    getUserId: async () => userId,
    consumeLimits: async (args) => {
      calls.limits.push(args);
      return { data: [{ allowed: true, retry_after: 0 }], error: null };
    },
    submit: async (args) => {
      calls.submissions.push(args);
      return { data: [order], error: null };
    },
    onError: (...args) => calls.errors.push(args),
    ...overrides,
  };
  return { deps, calls };
}

test('verified identity and database prices are the only authoritative inputs', async () => {
  const { deps, calls } = dependencies();
  const response = await handleOrderRequest(
    request({
      ...body,
      customerUserId: 'forged',
      total: 0,
      items: [{ ...body.items[0], price: 0 }],
    }),
    deps,
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).total, 120);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.submissions[0].p_customer_user_id, userId);
  assert.equal(calls.submissions[0].p_payload.customerUserId, undefined);
  assert.equal(calls.submissions[0].p_payload.items[0].price, undefined);
});
test('same normalized request has the same fingerprint; ignored fields cannot cause conflicts', async () => {
  const { deps, calls } = dependencies();
  await handleOrderRequest(request(body), deps);
  await handleOrderRequest(
    request({ ...body, total: 999, billing: { ...body.billing, ignored: true } }),
    deps,
  );
  assert.equal(calls.submissions[0].p_request_hash, calls.submissions[1].p_request_hash);
  await handleOrderRequest(request({ ...body, note: 'changed' }), deps);
  assert.notEqual(calls.submissions[0].p_request_hash, calls.submissions[2].p_request_hash);
});
test('replay returns the original result with HTTP 200', async () => {
  const { deps } = dependencies({
    submit: async () => ({ data: [{ ...order, replayed: true }], error: null }),
  });
  const response = await handleOrderRequest(request(), deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('idempotency-replayed'), 'true');
  assert.equal((await response.json()).reference, 'OZ-TEST');
});
test('conflicting key returns 409; infrastructure errors return 503 without leaking DB details', async () => {
  for (const [code, status] of [
    ['PT409', 409],
    ['XX000', 503],
  ]) {
    const { deps, calls } = dependencies({
      submit: async () => ({ data: null, error: { code, message: 'database-detail' } }),
    });
    const response = await handleOrderRequest(request(), deps);
    assert.equal(response.status, status);
    if (status === 503) {
      assert.doesNotMatch(await response.text(), /database-detail/);
      assert.deepEqual(calls.errors, [['order_submission_failed', 'XX000']]);
    }
  }
});
test('rate limiting responds 429 / Retry-After and never submits an order', async () => {
  const { deps, calls } = dependencies({
    consumeLimits: async () => ({ data: [{ allowed: false, retry_after: 42 }], error: null }),
  });
  const response = await handleOrderRequest(request(), deps);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '42');
  assert.equal(calls.submissions.length, 0);
});
test('limiter outage fails closed and a guest still gets a signed retry cookie', async () => {
  const { deps, calls } = dependencies({
    getUserId: async () => null,
    consumeLimits: async () => ({ data: null, error: { code: '08006', message: 'internal' } }),
  });
  const response = await handleOrderRequest(request(), deps);
  assert.equal(response.status, 503);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal(calls.submissions.length, 0);
});
test('missing key, foreign origin, bad JSON and invalid items cannot submit', async () => {
  for (const [req, status] of [
    [request(body, { 'idempotency-key': '' }), 400],
    [request(body, { origin: 'https://other.example' }), 403],
    [request('{bad'), 400],
    [request({ ...body, items: [{ ...body.items[0], quantity: 1.5 }] }), 400],
    [request({ ...body, privacyNoticeRead: false }), 400],
  ]) {
    const { deps, calls } = dependencies();
    assert.equal((await handleOrderRequest(req, deps)).status, status);
    assert.equal(calls.submissions.length, 0);
  }
});
test('unknown-length UTF-8 bodies are cancelled as soon as the byte budget is exceeded', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('ü'.repeat(4000)));
      controller.enqueue(new TextEncoder().encode('ü'.repeat(2000)));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request(request().url, {
    method: 'POST',
    headers: request().headers,
    body: stream,
    duplex: 'half',
  });
  const { deps, calls } = dependencies();
  assert.equal((await handleOrderRequest(req, deps)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(calls.limits.length, 0);
});
test('signed guest cookies survive retries; tampering cannot choose a rate bucket', () => {
  const first = orderRequestIdentity(request(), null, 'secret', null);
  const cookie = first.cookie.split(';')[0];
  const retry = orderRequestIdentity(request(body, { cookie }), null, 'secret', null);
  assert.equal(first.actorKey, retry.actorKey);
  assert.equal(retry.cookie, null);
  const tampered = orderRequestIdentity(
    request(body, { cookie: cookie.replace(/.$/, cookie.endsWith('a') ? 'b' : 'a') }),
    null,
    'secret',
    null,
  );
  assert.notEqual(first.actorKey, tampered.actorKey);
});
test('untrusted IP headers are ignored; trusted addresses are hashed and canonicalized', () => {
  assert.equal(
    orderRequestIdentity(request(body, { 'x-forwarded-for': '1.2.3.4' }), userId, 'secret', null)
      .ipKey,
    null,
  );
  assert.throws(() => orderRequestIdentity(request(), userId, 'secret', 'x-real-ip'));
  const a = orderRequestIdentity(
    request(body, { 'x-real-ip': '2001:db8::1' }),
    userId,
    'secret',
    'x-real-ip',
  );
  const b = orderRequestIdentity(
    request(body, { 'x-real-ip': '2001:0db8:0:0:0:0:0:1' }),
    userId,
    'secret',
    'x-real-ip',
  );
  assert.equal(a.ipKey, b.ipKey);
  assert.match(a.ipKey, /^[a-f0-9]{64}$/);
});

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}
test('client retry/reload keeps its key without storing personal details; edits create a new attempt', async () => {
  const saved = storage();
  const first = await checkoutAttempt(JSON.stringify(body), null, saved);
  const retry = await checkoutAttempt(JSON.stringify(body), null, saved);
  assert.equal(first.key, retry.key);
  assert.doesNotMatch([...saved.values.values()].join(), /Test buyer|05551112222/);
  const edited = await checkoutAttempt(JSON.stringify({ ...body, note: 'edited' }), retry, saved);
  assert.notEqual(edited.key, first.key);
  clearCheckoutAttempt(edited, saved);
  assert.equal(saved.values.size, 0);
});
test('unavailable browser storage falls back to the in-memory attempt', async () => {
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  const first = await checkoutAttempt('payload', null, blocked);
  assert.equal((await checkoutAttempt('payload', first, blocked)).key, first.key);
  assert.doesNotThrow(() => clearCheckoutAttempt(first, blocked));
});

test('a late success from an older form cannot erase a newer attempt', async () => {
  const saved = storage();
  const first = await checkoutAttempt('first payload', null, saved);
  const second = await checkoutAttempt('second payload', null, saved);
  clearCheckoutAttempt(first, saved);
  assert.equal((await checkoutAttempt('second payload', null, saved)).key, second.key);
});
