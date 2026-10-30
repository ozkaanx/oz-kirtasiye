import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  safeCustomerNext,
  customerAuthError,
  completeCustomerAuthCallback,
} from '../src/lib/customer-auth.ts';

test('login return paths reject browser-normalized external destinations', () => {
  for (const path of [
    undefined,
    '//evil.test',
    '/\\evil.test',
    '/\t/evil.test',
    '/\n/evil.test',
    'https://evil.test',
    '/\u0000bad',
  ]) {
    assert.equal(safeCustomerNext(path), '/hesabim');
  }
  assert.equal(safeCustomerNext('/sepet?from=login#items'), '/sepet?from=login#items');
});

test('authentication errors never expose provider messages or identify registered accounts', () => {
  assert.equal(
    customerAuthError({ code: 'user_already_exists' }, 'register'),
    customerAuthError({ code: 'unexpected' }, 'register'),
  );
  assert.match(customerAuthError({ status: 429 }, 'forgot'), /bekleyip/);
  assert.match(customerAuthError({ code: 'email_not_confirmed' }, 'login'), /doğrula/);
  assert.match(customerAuthError({ code: 'same_password' }, 'reset'), /farklı/);
});

test('callback exchanges PKCE code and confines next to fixed destinations', async () => {
  let exchanged;
  const auth = {
    exchangeCodeForSession: async (code) => {
      exchanged = code;
      return { error: null };
    },
    verifyOtp: async () => {
      throw Error('unexpected');
    },
  };
  assert.equal(
    await completeCustomerAuthCallback(
      new URLSearchParams({ code: 'test-code', next: 'https://evil.test' }),
      auth,
    ),
    '/hesabim',
  );
  assert.equal(exchanged, 'test-code');
  assert.equal(
    await completeCustomerAuthCallback(
      new URLSearchParams({ code: 'test-code', next: '/sifre-yenile' }),
      auth,
    ),
    '/sifre-yenile',
  );
});

test('recovery token links always reach the password page, including without next', async () => {
  let input;
  const auth = {
    exchangeCodeForSession: async () => {
      throw Error('unexpected');
    },
    verifyOtp: async (value) => {
      input = value;
      return { error: null };
    },
  };
  assert.equal(
    await completeCustomerAuthCallback(
      new URLSearchParams({ token_hash: 'hash', type: 'recovery' }),
      auth,
    ),
    '/sifre-yenile',
  );
  assert.deepEqual(input, { token_hash: 'hash', type: 'recovery' });
});

test('expired, ambiguous and missing callback credentials fail closed without leaking secrets', async () => {
  let calls = 0;
  const auth = {
    exchangeCodeForSession: async () => {
      calls++;
      return { error: { message: 'private' } };
    },
    verifyOtp: async () => {
      calls++;
      throw Error('private');
    },
  };
  const failure = '/giris?error=dogrulama';
  for (const input of [
    {},
    { error: 'access_denied' },
    { token_hash: 'hash', type: 'invite' },
    { code: 'code', token_hash: 'hash' },
  ]) {
    assert.equal(await completeCustomerAuthCallback(new URLSearchParams(input), auth), failure);
  }
  assert.equal(calls, 0);
  assert.equal(
    await completeCustomerAuthCallback(new URLSearchParams({ code: 'expired' }), auth),
    failure,
  );
  assert.equal(
    await completeCustomerAuthCallback(
      new URLSearchParams({ token_hash: 'expired', type: 'signup' }),
      auth,
    ),
    failure,
  );
});
