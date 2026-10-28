import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleProductImport } from '../src/lib/admin-import-handler.ts';

function request(mode = 'preview', expected) {
  const form = new FormData();
  form.set('file', new File(['sku;price;stock_quantity\nTEST-PEN;25,50;4'], 'test.csv'));
  form.set('mode', mode);
  form.set('allowStockUpdates', 'true');
  if (expected) form.set('expected', JSON.stringify(expected));
  return new Request('https://store.invalid/api/admin/product-import', {
    method: 'POST',
    body: form,
  });
}
const success = {
  created: 0,
  updated: 1,
  rows: [{ sku: 'TEST-PEN', row: 1, action: 'update', previous_stock: 7, previous_price: 20 }],
  expected: [{ id: 'product', signature: 'snapshot' }],
};

test('HTTP import enforces admin authorization before reading the file or calling RPC', async () => {
  let reads = 0,
    runs = 0;
  for (const status of [401, 403]) {
    const req = request();
    req.formData = async () => {
      reads++;
      throw Error('must not read');
    };
    const response = await handleProductImport(req, {
      authorize: async () => status,
      run: async () => {
        runs++;
        return { data: success, error: null };
      },
    });
    assert.equal(response.status, status);
  }
  assert.equal(reads, 0);
  assert.equal(runs, 0);
  const req = request();
  req.headers.set('sec-fetch-site', 'cross-site');
  assert.equal(
    (
      await handleProductImport(req, {
        authorize: () => {
          throw Error('must not authorize');
        },
      })
    ).status,
    403,
  );
});

test('preview and confirmation preserve old values and send only normalized file fields plus snapshot', async () => {
  const calls = [];
  const deps = {
    authorize: async () => 0,
    run: async (args) => {
      calls.push(args);
      return { data: success, error: null };
    },
  };
  const preview = await handleProductImport(request(), deps);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('cache-control'), 'no-store');
  const data = await preview.json();
  assert.equal(data.rows[0].price, 25.5);
  assert.equal(data.rows[0].previous_stock, 7);
  const commit = await handleProductImport(request('commit', data.expected), deps);
  assert.equal(commit.status, 200);
  assert.equal(calls[0].p_commit, false);
  assert.equal(calls[0].p_expected, null);
  assert.equal(calls[1].p_allow_stock_updates, true);
  assert.deepEqual(calls[1].p_expected, success.expected);
  assert.equal(calls[1].p_rows[0].stock_quantity, 4);
});

test('stale import returns safe HTTP 409 and database outage never exposes stack or secrets', async () => {
  const deps = {
    authorize: async () => 0,
    run: async () => ({ data: null, error: { code: '40001', message: 'internal secret' } }),
  };
  const response = await handleProductImport(request('commit', success.expected), deps);
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /yeniden kontrol/);
  deps.run = async () => ({
    data: null,
    error: { code: 'XX000', message: 'database password stack trace' },
  });
  const outage = await handleProductImport(request(), deps);
  assert.equal(outage.status, 503);
  assert.doesNotMatch(await outage.text(), /password|stack/);
});

test('unknown-length oversized multipart gets HTTP 413 before parser or RPC', async () => {
  let stopped = false,
    runs = 0;
  const body = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(1024 * 1024));
    },
    cancel() {
      stopped = true;
    },
  });
  const req = new Request('https://store.invalid/import', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: { 'content-type': 'multipart/form-data; boundary=x' },
  });
  const response = await handleProductImport(req, {
    authorize: async () => 0,
    run: async () => {
      runs++;
      return { data: success, error: null };
    },
  });
  assert.equal(response.status, 413);
  assert.equal(stopped, true);
  assert.equal(runs, 0);
});
