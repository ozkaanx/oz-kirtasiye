import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSafeStorage } from '../src/lib/safe-storage.ts';
import { boundedFormData, BodyLimitError } from '../src/lib/bounded-form-data.ts';
import { saveProductImage } from '../src/lib/product-save.ts';
import {
  customerPageNumber,
  customerPageMeta,
  customerPageHref,
} from '../src/lib/customer-pagination.ts';

test('blocked storage and quota errors preserve the current tab cart/coupon/favorites', () => {
  const storage = createSafeStorage(() => {
    throw new DOMException('Blocked', 'SecurityError');
  });
  assert.equal(storage.getItem('cart'), null);
  for (const key of ['cart', 'favorites', 'coupon']) {
    storage.setItem(key, 'value');
    assert.equal(storage.getItem(key), 'value');
  }
  const quota = createSafeStorage(() => ({
    getItem: () => 'old',
    setItem: () => {
      throw new DOMException('Full', 'QuotaExceededError');
    },
  }));
  assert.equal(quota.getItem('cart'), 'old');
  quota.setItem('cart', 'new');
  assert.equal(quota.getItem('cart'), 'new');
});

test('multipart includes all fields in byte budget even without content-length and cancels early', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(700));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('https://store.invalid/import', {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: { 'content-type': 'multipart/form-data; boundary=x' },
  });
  await assert.rejects(boundedFormData(request, 1024), BodyLimitError);
  assert.equal(cancelled, true);
  const form = new FormData();
  form.set('file', new File(['sku;price\nP1;2'], 'test.csv'));
  form.set('expected', '[]');
  const parsed = await boundedFormData(
    new Request('https://store.invalid/import', { method: 'POST', body: form }),
    4096,
  );
  assert.equal(await parsed.get('file').text(), 'sku;price\nP1;2');
  assert.equal(parsed.get('expected'), '[]');
});

test('image metadata failure cleans orphan; retry uses the same path and only one successful record', async () => {
  const photo = new File(['x'], 'test.png');
  const progress = { photo: null, path: null, uploaded: false };
  let records = 0,
    uploads = 0,
    removes = 0;
  const deps = {
    makePath: () => 'product/image.png',
    upload: async () => {
      uploads++;
      return { error: null };
    },
    record: async () => ({ error: ++records === 1 ? { message: 'offline' } : null }),
    recorded: async () => ({ found: false, error: null }),
    remove: async () => {
      removes++;
      return { error: null };
    },
  };
  await assert.rejects(saveProductImage(progress, photo, deps), /görsel kaydı/);
  await saveProductImage(progress, photo, deps);
  assert.equal(uploads, 2);
  assert.equal(removes, 1);
  assert.equal(records, 2);
  assert.equal(progress.path, 'product/image.png');
});

test('lost metadata response never deletes a successfully recorded image; uncertain reads reuse upload', async () => {
  const photo = new File(['x'], 'image.png');
  let uploads = 0,
    removes = 0;
  const deps = {
    makePath: () => 'one-path',
    upload: async () => {
      uploads++;
      return { error: null };
    },
    record: async () => ({ error: { message: 'lost response' } }),
    recorded: async () => ({ error: null, found: true }),
    remove: async () => {
      removes++;
      return { error: null };
    },
  };
  await saveProductImage({ photo: null, path: null, uploaded: false }, photo, deps);
  assert.equal(removes, 0);
  const progress = { photo: null, path: null, uploaded: false };
  deps.recorded = async () => ({ error: { message: 'offline' }, found: false });
  await assert.rejects(saveProductImage(progress, photo, deps), /doğrulanamadı/);
  deps.record = async () => ({ error: null });
  await saveProductImage(progress, photo, deps);
  assert.equal(uploads, 2);
  assert.equal(removes, 0);
});

test('customer pagination reaches old orders, clamps and preserves independent return pages', () => {
  assert.deepEqual(customerPageMeta(61, 9), { total: 61, pages: 4, page: 4 });
  for (const value of ['0', '-1', '1.2', ['2'], '9999999'])
    assert.equal(customerPageNumber(value), 1);
  assert.equal(customerPageNumber('3'), 3);
  assert.equal(
    customerPageHref('/hesabim', { tab: 'orders' }, 'page', 2),
    '/hesabim?tab=orders&page=2',
  );
  assert.equal(
    customerPageHref('/hesabim/iade', { ordersPage: '4' }, 'requestsPage', 3),
    '/hesabim/iade?ordersPage=4&requestsPage=3',
  );
});
