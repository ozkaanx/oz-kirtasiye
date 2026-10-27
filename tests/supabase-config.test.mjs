import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedSupabaseUrl } from '../src/lib/supabase/config.ts';

test('hosted Supabase requires HTTPS', () => {
  assert.equal(isAllowedSupabaseUrl('https://project.supabase.co'), true);
  assert.equal(isAllowedSupabaseUrl('http://project.supabase.co'), false);
});
test('local Supabase supports IPv4, IPv6 and localhost HTTP', () => {
  for (const host of ['127.0.0.1', '[::1]', 'localhost']) {
    assert.equal(isAllowedSupabaseUrl(`http://${host}:54321`), true);
  }
});
test('remote lookalikes and credentials are not local URLs', () => {
  for (const url of [
    'http://localhost.example.com',
    'http://127.0.0.1.example.com',
    'https://user:password@example.com',
    'not a URL',
    'file:///tmp/api',
  ]) {
    assert.equal(isAllowedSupabaseUrl(url), false);
  }
});
