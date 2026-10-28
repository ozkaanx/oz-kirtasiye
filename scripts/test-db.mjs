import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to an isolated local/test database. Never use production.',
  );
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Database regressions may only run on an isolated local database.');
}
for (const file of readdirSync('supabase/tests')
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  const result = spawnSync(
    'psql',
    ['-X', '--dbname', databaseUrl, '--set', 'ON_ERROR_STOP=1', '--file', `supabase/tests/${file}`],
    {
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const concurrency = spawnSync(process.execPath, ['supabase/tests/order-concurrency.mjs'], {
  stdio: 'inherit',
});
if (concurrency.error) throw concurrency.error;
if (concurrency.status !== 0) process.exit(concurrency.status ?? 1);

const paymentConcurrency = spawnSync(process.execPath, ['supabase/tests/payment-concurrency.mjs'], {
  stdio: 'inherit',
});
if (paymentConcurrency.error) throw paymentConcurrency.error;
if (paymentConcurrency.status !== 0) process.exit(paymentConcurrency.status ?? 1);
