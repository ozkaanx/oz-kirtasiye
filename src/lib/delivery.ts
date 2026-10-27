/** Browser estimates are informational; PostgreSQL remains the charge authority. */
export type DeliveryMethod = 'shipping' | 'pickup';
export type DeliverySettings = {
  shipping_enabled: boolean;
  pickup_enabled: boolean;
  shipping_flat_fee: number | null;
  free_shipping_threshold: number | null;
  registered_address: string;
  pickup_instructions: string | null;
};
export type DeliveryQuote = {
  available: boolean;
  fee: number | null;
  total: number | null;
  freeShippingRemaining: number | null;
};
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
const unavailable = (): DeliveryQuote => ({
  available: false,
  fee: null,
  total: null,
  freeShippingRemaining: null,
});

export function deliveryQuote(
  settings: DeliverySettings,
  subtotal: number,
  method: DeliveryMethod,
): DeliveryQuote {
  if (!Number.isFinite(subtotal) || subtotal < 0) return unavailable();
  const net = cents(subtotal);
  if (method === 'pickup') {
    return settings.pickup_enabled
      ? { available: true, fee: 0, total: net / 100, freeShippingRemaining: null }
      : unavailable();
  }
  const base = settings.shipping_flat_fee;
  if (!settings.shipping_enabled || base === null || !Number.isFinite(base) || base < 0)
    return unavailable();
  const threshold = settings.free_shipping_threshold;
  const target =
    threshold !== null && Number.isFinite(threshold) && threshold >= 0 ? cents(threshold) : null;
  const free = target !== null && net >= target;
  const fee = free ? 0 : cents(base);
  return {
    available: true,
    fee: fee / 100,
    total: (net + fee) / 100,
    freeShippingRemaining: target !== null && !free ? (target - net) / 100 : null,
  };
}

type ServerTotals = {
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
};
export type PricingPreview = { quote: ServerTotals | null; loading: boolean; error: string };

/** One display model for cart and checkout, including discounted free-shipping eligibility. */
export function cartPricing(
  settings: DeliverySettings,
  subtotal: number,
  method: DeliveryMethod,
  preview: PricingPreview,
  couponCode: string,
) {
  const candidate = preview.quote;
  const valid =
    candidate !== null &&
    [candidate.subtotal, candidate.discountAmount, candidate.shippingFee, candidate.total].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) &&
    candidate.discountAmount <= candidate.subtotal &&
    cents(candidate.total) ===
      cents(candidate.subtotal) - cents(candidate.discountAmount) + cents(candidate.shippingFee);
  const quote = valid ? candidate : null;
  const products = quote ? cents(quote.subtotal) : cents(subtotal);
  const discount = quote ? cents(quote.discountAmount) : 0;
  const netSubtotal = (products - discount) / 100;
  const delivery = deliveryQuote(settings, netSubtotal, method);
  return {
    subtotal: products / 100,
    discountAmount: discount / 100,
    netSubtotal,
    delivery,
    shippingFee: delivery.available ? (quote?.shippingFee ?? delivery.fee) : null,
    total: delivery.available ? (quote?.total ?? delivery.total) : null,
    freeShippingRemaining: delivery.freeShippingRemaining,
    fromServer: quote !== null,
    couponBlocked: !!couponCode && (preview.loading || !!preview.error || !quote),
  };
}
export type CartPricing = ReturnType<typeof cartPricing>;
