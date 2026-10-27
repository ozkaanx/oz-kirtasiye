export type CheckoutAttempt = { fingerprint: string; key: string };
const STORAGE_KEY = 'oz-kirtasiye-checkout-attempt-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function browserStorage(): AttemptStorage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
/** Persist only a hash and random key, never delivery/billing details. */
export async function checkoutAttempt(
  payload: string,
  previous: CheckoutAttempt | null,
  storage = browserStorage(),
): Promise<CheckoutAttempt> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  let saved: CheckoutAttempt | null = previous;
  if (!saved) {
    try {
      saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      /* Storage is optional. */
    }
  }
  if (saved?.fingerprint === fingerprint && typeof saved.key === 'string' && UUID.test(saved.key))
    return saved;
  const attempt = { fingerprint, key: crypto.randomUUID() };
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    /* The ref still protects retries. */
  }
  return attempt;
}
export function clearCheckoutAttempt(attempt: CheckoutAttempt | null, storage = browserStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (attempt && saved?.key === attempt.key) storage?.removeItem(STORAGE_KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}
