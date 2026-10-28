import { randomUUID } from 'node:crypto';

type Operation =
  | 'order_submission'
  | 'coupon_quote'
  | 'admin_order_search'
  | 'admin_product_search'
  | 'admin_order_action';
type Event = 'unavailable' | 'database_error' | 'empty_result' | 'unexpected';

/** Allowlisted fields only: never bodies, URLs, customer IDs, error messages or stacks. */
export function operationTrace(
  operation: Operation,
  write = (line: string) => console.error(line),
) {
  const requestId = randomUUID();
  const started = performance.now();
  return {
    requestId,
    error(event: Event, code?: string) {
      write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          operation,
          event,
          requestId,
          code: code && /^[A-Z0-9]{2,16}$/.test(code) ? code : undefined,
          durationMs: Math.round(performance.now() - started),
        }),
      );
    },
  };
}
