/** Browser storage only contains identifiers and quantities. Prices always come from Supabase. */
export type CartLine = { productId: string; variantId?: string | null; quantity: number };

export function cartLineKey(productId: string, variantId?: string | null): string {
  return `${productId}:${variantId ?? 'standard'}`;
}

export type CartProduct = {
  id: string;
  variantId: string | null;
  key: string;
  slug: string;
  name: string;
  variantLabel: string | null;
  price: number;
  stock_quantity: number;
  imageUrl: string | null;
};

export type OrderRequestResult = {
  id: string;
  reference: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  deliveryMethod: 'shipping' | 'pickup';
};
