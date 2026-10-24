import type { CartLine } from '@/lib/cart-types';
import type { DeliveryMethod } from '@/lib/delivery';

export type CouponQuote = {
  code: string;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
};

export type CouponPreviewRequest = {
  items: CartLine[];
  deliveryMethod: DeliveryMethod;
  couponCode: string;
};

export function normalizeCouponCode(raw: string) {
  return raw.trim().toUpperCase();
}
