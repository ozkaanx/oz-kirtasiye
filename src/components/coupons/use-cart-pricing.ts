'use client';

import { useShop } from '@/context/shop-context';
import { cartPricing, type DeliveryMethod, type DeliverySettings } from '@/lib/delivery';
import { useCouponQuote } from './use-coupon-quote';

export function useCartPricing(settings: DeliverySettings, method: DeliveryMethod) {
  const { cart, cartSubtotal, couponCode } = useShop();
  const promo = useCouponQuote(cart, method);
  return { promo, pricing: cartPricing(settings, cartSubtotal, method, promo, couponCode) };
}
