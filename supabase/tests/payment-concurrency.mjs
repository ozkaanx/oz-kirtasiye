import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Runs only against an isolated local database, never production.
const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
  throw new Error('Payment concurrency tests require isolated local TEST_DATABASE_URL.');

const pool = new pg.Pool({ connectionString: url, max: 6 });
const product = randomUUID();
const orders = [randomUUID(), randomUUID()];
const merchantOids = [randomUUID(), randomUUID()].map((id) => 'PCC-' + id);
let left;
let right;
try {
  await pool.query(
    `insert into public.products(id,slug,name,price,stock_quantity,is_active)
     values($1,$2,'Payment concurrency pencil',100,5,true)`,
    [product, 'payment-concurrent-' + product],
  );
  for (let index = 0; index < 2; index++) {
    await pool.query(
      `insert into public.order_requests(
       id,reference,customer_name,phone,city,district,address,subtotal,total)
       values($1,$2,'Concurrent buyer',$3,'Istanbul','Bagcilar','Test address 123',300,300)`,
      [orders[index], 'PCC-' + orders[index], '0555' + String(index).padStart(7, '0')],
    );
    await pool.query(
      `insert into public.order_request_items(
       order_request_id,product_id,product_name,unit_price,quantity,line_total)
       values($1,$2,'Payment concurrency pencil',100,3,300)`,
      [orders[index], product],
    );
  }

  left = await pool.connect();
  right = await pool.connect();
  await Promise.all([left.query('set role service_role'), right.query('set role service_role')]);
  const reserve = (client, order, merchantOid) =>
    client.query('select * from public.begin_payment_reservation($1,$2,900)', [order, merchantOid]);

  const first = await Promise.allSettled([
    reserve(left, orders[0], merchantOids[0]),
    reserve(right, orders[1], merchantOids[1]),
  ]);
  assert.equal(first.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(first.filter((item) => item.status === 'rejected').length, 1);
  assert.equal(first.find((item) => item.status === 'rejected').reason.code, '22023');
  assert.equal(
    (await pool.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity,
    2,
  );
  assert.equal(
    (await pool.query('select count(*)::int n from private.payment_attempts where order_request_id=any($1::uuid[])', [orders])).rows[0].n,
    1,
  );
  console.log('PASS: overlapping payment reservations cannot oversell five units');

  const winning = first.findIndex((item) => item.status === 'fulfilled');
  const losing = 1 - winning;
  await (winning === 0 ? left : right).query(
    'select public.finish_payment_reservation($1,$2)',
    [merchantOids[winning], 'failed'],
  );
  assert.equal(
    (await pool.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity,
    5,
  );
  console.log('PASS: failed payment restores stock after concurrent contention');

  // A simultaneous retry of the same order/payment ID is an idempotent read:
  // both receive the same attempt, only a single physical stock deduction.
  const second = await Promise.all([
    reserve(left, orders[losing], merchantOids[losing]),
    reserve(right, orders[losing], merchantOids[losing]),
  ]);
  assert.equal(second[0].rows[0].payment_id, second[1].rows[0].payment_id);
  assert.equal(
    (await pool.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity,
    2,
  );
  console.log('PASS: concurrent repeat reservation uses one payment attempt');
} finally {
  left?.release(true);
  right?.release(true);
  try {
    await pool.query(
      `delete from private.payment_reserved_items where payment_id in
       (select id from private.payment_attempts where order_request_id=any($1::uuid[]))`,
      [orders],
    );
    await pool.query('delete from private.payment_attempts where order_request_id=any($1::uuid[])', [orders]);
    await pool.query('delete from public.order_request_items where order_request_id=any($1::uuid[])', [orders]);
    await pool.query('delete from public.order_requests where id=any($1::uuid[])', [orders]);
    await pool.query('delete from public.products where id=$1', [product]);
  } finally {
    await pool.end();
  }
}
