export type CategoryId = 'defter' | 'kalem' | 'boya' | 'oyuncak' | 'canta' | 'ofis';

export type Category = {
  id: CategoryId;
  label: string;
  caption: string;
  picture: string;
  color: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategoryId;
  description: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  image: string;
  tint: string;
  featured?: boolean;
};

export type CartLine = { productId: string; quantity: number };
