'use client';

import { useRef, useState } from 'react';
import {
  checkoutAttempt,
  clearCheckoutAttempt,
  type CheckoutAttempt,
} from '@/lib/checkout-attempt';
import type { OrderRequestResult } from '@/lib/cart-types';

export function useOrderSubmission({
  refreshCart,
  clearCart,
}: {
  refreshCart: () => Promise<void>;
  clearCart: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<OrderRequestResult | null>(null);
  const attemptRef = useRef<CheckoutAttempt | null>(null);
  const submitting = useRef(false);

  async function send(payload: Record<string, unknown>) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await refreshCart();
      const raw = JSON.stringify(payload);
      attemptRef.current = await checkoutAttempt(raw, attemptRef.current);
      const response = await fetch('/api/order-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attemptRef.current.key },
        body: raw,
      });
      const result: OrderRequestResult & { message?: string } = await response.json();
      if (!response.ok) {
        const traceId = response.headers.get('x-request-id');
        const support = response.status >= 500 && traceId ? ` Takip kodu: ${traceId}` : '';
        throw new Error((result.message || 'Sipariş talebi oluşturulamadı.') + support);
      }
      setCompleted(result);
      clearCheckoutAttempt(attemptRef.current);
      attemptRef.current = null;
      clearCart();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Beklenmeyen hata oluştu.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return { pending, error, setError, completed, send };
}
