import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'Set TEST_DATABASE_URL to an isolated local/test database. Never use production.',
  );
}
for (const file of readdirSync('supabase/tests')
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  const result = spawnSync(
    'psql',
    ['-X', '--set', 'ON_ERROR_STOP=1', '--file', `supabase/tests/${file}`],
    {
      stdio: 'inherit',
      env: { ...process.env, PGDATABASE: databaseUrl },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
