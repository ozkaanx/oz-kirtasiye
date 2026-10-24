'use client';

import { useEffect, useMemo, useState } from 'react';
import { useShop } from '@/context/shop-context';
import type { CartLine } from '@/lib/cart-types';
import type { DeliveryMethod } from '@/lib/delivery';
import type { CouponQuote } from '@/lib/coupon';

type Result = { key: string; quote: CouponQuote | null; error: string };

export function useCouponQuote(items: CartLine[], deliveryMethod: DeliveryMethod) {
  const { couponCode } = useShop();
  const [result, setResult] = useState<Result | null>(null);
  const itemsKey = useMemo(() => JSON.stringify(items), [items]);
  const key = `${couponCode}:${deliveryMethod}:${itemsKey}`;

  useEffect(() => {
    if (!couponCode) return;
    const controller = new AbortController();
    // Quotes are informational. Checkout revalidates price, limits, coupon and shipping atomically.
    const timer = setTimeout(() => { void (async () => {
      try {
        const response = await fetch('/api/coupon-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: JSON.parse(itemsKey), deliveryMethod, couponCode }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const data: CouponQuote & { message?: string } = await response.json();
        if (!response.ok) throw new Error(data.message || 'Kupon geçersiz.');
        if (!controller.signal.aborted) setResult({key, quote:data, error:''});
      } catch (cause) {
        if (!controller.signal.aborted) setResult({key, quote:null, error:cause instanceof Error ? cause.message : 'Kupon doğrulanamadı.'});
      }
    })(); }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [couponCode, deliveryMethod, itemsKey, key]);

  if (!couponCode) return {quote:null,error:'',loading:false};
  if (!result || result.key!==key) return {quote:null,error:'',loading:true};
  return {quote:result.quote,error:result.error,loading:false};
}
