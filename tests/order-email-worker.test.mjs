import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmailWorker } from '../supabase/functions/order-email-worker/worker.ts';

const config = {
  serviceUrl: 'https://db.invalid',
  serviceKey: 'server-secret',
  resendKey: 'provider-secret',
};
const request = () =>
  new Request('https://worker.invalid', {
    method: 'POST',
    headers: {
      Authorization: `Bearer header.${Buffer.from(JSON.stringify({ role: 'service_role', ref: 'db' })).toString('base64url')}.signature`,
    },
  });
const job = {
  id: 'job-id',
  lease_token: 'lease-token',
  message: {
    from: 'Store <store@example.invalid>',
    to: ['buyer@example.invalid'],
    subject: 'Order',
    text: 'Frozen message',
  },
};

test('worker denies public/session credentials and never claims when unconfigured', async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    throw Error('must not run');
  };
  const worker = createEmailWorker(config, { fetch });
  assert.equal(
    (await worker(new Request('https://worker.invalid', { method: 'POST' }))).status,
    401,
  );
  assert.equal((await worker(new Request('https://worker.invalid'))).status, 405);
  assert.equal(
    (await createEmailWorker({ ...config, resendKey: undefined }, { fetch })(request())).status,
    503,
  );
  assert.equal(calls, 0);
  for (const claims of [
    { role: 'authenticated', ref: 'db' },
    { role: 'service_role', ref: 'other' },
  ]) {
    const response = await worker(
      new Request('https://worker.invalid', {
        method: 'POST',
        headers: {
          Authorization: `Bearer header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`,
        },
      }),
    );
    assert.equal(response.status, 401);
  }
});

test('worker sends frozen payload with stable idempotency and records accepted provider ID', async () => {
  let acknowledgement;
  const worker = createEmailWorker(config, {
    fetch: async (url, options) => {
      if (url.endsWith('claim_order_emails')) return Response.json([job]);
      if (url === 'https://api.resend.com/emails') {
        assert.equal(options.headers['Idempotency-Key'], 'order-email/job-id');
        assert.deepEqual(JSON.parse(options.body), job.message);
        return Response.json({ id: 'provider-id' });
      }
      acknowledgement = JSON.parse(options.body);
      return Response.json(true);
    },
  });
  assert.deepEqual(await (await worker(request())).json(), { accepted: 1, failed: 0 });
  assert.equal(acknowledgement.p_provider_id, 'provider-id');
  assert.equal(acknowledgement.p_lease_token, 'lease-token');
});

test('transient errors retry but permanent rejections do not; provider bodies never escape', async () => {
  for (const status of [400, 401, 403, 409, 422, 429, 500]) {
    let outcome;
    const worker = createEmailWorker(config, {
      fetch: async (url, options) => {
        if (url.endsWith('claim_order_emails')) return Response.json([job]);
        if (url === 'https://api.resend.com/emails')
          return Response.json({ secret: 'private provider detail' }, { status });
        outcome = JSON.parse(options.body);
        return Response.json(true);
      },
    });
    const response = await worker(request());
    assert.equal(outcome.p_error, `provider_${status}`);
    assert.equal(outcome.p_retry, status === 429 || status >= 500);
    assert.ok(!(await response.text()).includes('private'));
  }
});

test('network failures retry and acknowledgement failures stop the batch', async () => {
  let sends = 0;
  const worker = createEmailWorker(config, {
    fetch: async (url) => {
      if (url.endsWith('claim_order_emails')) return Response.json([job, { ...job, id: 'second' }]);
      if (url === 'https://api.resend.com/emails') {
        sends++;
        throw Error('sensitive');
      }
      return Response.json(false);
    },
  });
  assert.equal((await worker(request())).status, 503);
  assert.equal(sends, 1);
});
