import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
if (
  !connectionString ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)
) {
  throw new Error('Concurrency tests require an isolated local TEST_DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString, max: 45 });
const product = randomUUID();
const key = randomUUID();
const hash = createHash('sha256').update(key).digest('hex');
const actor = createHash('sha256').update(randomUUID()).digest('hex');
let originalPickup;
let first;
let second;
try {
  originalPickup = (await pool.query('select pickup_enabled from public.store_settings where id=1'))
    .rows[0].pickup_enabled;
  await pool.query('update public.store_settings set pickup_enabled=true where id=1');
  await pool.query(
    'insert into public.products(id,slug,name,price,stock_quantity,is_active) values($1,$2,$3,100,10,true)',
    [product, `concurrency-${product}`, 'Concurrency pencil'],
  );
  const payload = {
    customerName: 'Concurrency buyer',
    phone: `05${Date.now().toString().slice(-9)}`,
    city: 'Istanbul',
    district: 'Bagcilar',
    address: 'Test address 123',
    note: '',
    items: [{ productId: product, quantity: 1 }],
    preInformationRead: true,
    privacyNoticeRead: true,
    noticeVersion: '2026-10-24-v2',
    deliveryMethod: 'pickup',
    couponCode: null,
    billing: {
      buyerType: 'individual',
      recipientName: 'Concurrency buyer',
      city: 'Istanbul',
      district: 'Bagcilar',
      address: 'Test address 123',
    },
  };
  first = await pool.connect();
  second = await pool.connect();
  await Promise.all([first.query('set role service_role'), second.query('set role service_role')]);
  const submit = (client) =>
    client.query('select * from public.submit_order_request_idempotent($1,$2,$3,null)', [
      key,
      hash,
      payload,
    ]);
  const results = await Promise.all([submit(first), submit(second)]);
  assert.equal(results[0].rows[0].id, results[1].rows[0].id);
  assert.deepEqual(results.map((r) => r.rows[0].replayed).sort(), [false, true]);
  assert.equal(
    (
      await pool.query(
        'select count(*)::int n from public.order_request_items where product_id=$1',
        [product],
      )
    ).rows[0].n,
    1,
  );
  console.log('PASS: concurrent submissions create one order and replay one response');
  const limits = await Promise.all(
    Array.from({ length: 21 }, () =>
      pool.query('select * from public.consume_order_request_limits($1,null)', [actor]),
    ),
  );
  assert.equal(limits.filter((r) => r.rows[0].allowed).length, 20);
  assert.equal(limits.filter((r) => !r.rows[0].allowed).length, 1);
  console.log('PASS: concurrent rate claims cannot overspend the actor limit');
} finally {
  // These two connections changed role; destroy them rather than recycling it into cleanup.
  first?.release(true);
  second?.release(true);
  try {
    await pool.query('delete from private.order_request_rate_limits where key=any($1)', [[`actor:${actor}`, 'global']]);
    await pool.query('delete from private.order_request_submissions where request_key=$1', [key]);
    await pool.query(
      'delete from public.order_requests where id in(select order_request_id from public.order_request_items where product_id=$1)',
      [product],
    );
    await pool.query('delete from public.products where id=$1', [product]);
    if (originalPickup !== undefined)
      await pool.query('update public.store_settings set pickup_enabled=$1 where id=1', [
        originalPickup,
      ]);
  } finally {
    await pool.end();
  }
}
