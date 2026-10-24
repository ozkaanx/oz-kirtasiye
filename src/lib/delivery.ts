/** The browser only estimates; submit_order_request_with_delivery computes the final charge in Postgres. */
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

export function deliveryQuote(
  settings: DeliverySettings,
  subtotal: number,
  method: DeliveryMethod,
): DeliveryQuote {
  if (method === 'pickup') {
    return {
      available: settings.pickup_enabled,
      fee: settings.pickup_enabled ? 0 : null,
      total: settings.pickup_enabled ? subtotal : null,
      freeShippingRemaining: null,
    };
  }
  const baseFee = settings.shipping_flat_fee;
  if (!settings.shipping_enabled || baseFee === null || !Number.isFinite(baseFee)) {
    return { available: false, fee: null, total: null, freeShippingRemaining: null };
  }
  const threshold = settings.free_shipping_threshold;
  const free = threshold !== null && subtotal >= threshold;
  const fee = free ? 0 : baseFee;
  return {
    available: true,
    fee,
    total: Math.round((subtotal + fee) * 100) / 100,
    freeShippingRemaining:
      threshold !== null && !free ? Math.round((threshold - subtotal) * 100) / 100 : null,
  };
}
