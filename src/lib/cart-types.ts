/** Only identifiers and quantities are persisted locally, never client-side prices. */
export type CartLine = { productId: string; quantity: number };

export type CartProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock_quantity: number;
  imageUrl: string | null;
};

export type OrderRequestResult = { id: string; reference: string; subtotal: number };
