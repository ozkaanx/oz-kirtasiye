'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine, CartProduct } from '@/lib/cart-types';

type ShopContextValue = {
  cart: CartLine[];
  products: Record<string, CartProduct>;
  cartLoading: boolean;
  cartError: string;
  favorites: string[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (productId: string, amount?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  cartCount: number;
  cartSubtotal: number;
  cartIsValid: boolean;
  refreshCart: () => Promise<void>;
};

const ShopContext = createContext<ShopContextValue | null>(null);
const CART_KEY = 'oz-kirtasiye-real-cart-v1';
const FAVORITES_KEY = 'oz-kirtasiye-real-favorites-v1';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function readCart(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .filter((line): line is CartLine => {
        if (
          !line ||
          typeof line !== 'object' ||
          typeof line.productId !== 'string' ||
          !UUID.test(line.productId) ||
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 99 ||
          seen.has(line.productId)
        )
          return false;
        seen.add(line.productId);
        return true;
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

function readFavorites(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? [
          ...new Set(parsed.filter((id): id is string => typeof id === 'string' && UUID.test(id))),
        ].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Record<string, CartProduct>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');

  useEffect(() => {
    setCart(readCart());
    setFavorites(readFavorites());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, loaded]);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, loaded]);

  const ids = useMemo(
    () =>
      cart
        .map((line) => line.productId)
        .sort()
        .join(','),
    [cart],
  );
  const loadProducts = useCallback(async (productIds: string[], signal?: AbortSignal) => {
    if (!productIds.length) {
      setProducts({});
      setCartLoading(false);
      setCartError('');
      return;
    }
    setCartLoading(true);
    setCartError('');
    try {
      const response = await fetch(
        `/api/cart-items?ids=${encodeURIComponent(productIds.join(','))}`,
        {
          cache: 'no-store',
          signal,
        },
      );
      if (!response.ok) throw new Error('Sepet ürünleri yüklenemedi.');
      const body: { products: CartProduct[] } = await response.json();
      if (signal?.aborted) return;
      setProducts(Object.fromEntries(body.products.map((product) => [product.id, product])));
    } catch (error) {
      if (signal?.aborted) return;
      setCartError(error instanceof Error ? error.message : 'Sepet ürünleri yüklenemedi.');
    } finally {
      if (!signal?.aborted) setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    void loadProducts(ids ? ids.split(',') : [], controller.signal);
    return () => controller.abort();
  }, [ids, loaded, loadProducts]);

  const refreshCart = useCallback(async () => {
    await loadProducts(cart.map((line) => line.productId));
  }, [cart, loadProducts]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (!UUID.test(productId) || !Number.isInteger(quantity)) return;
    setCart((previous) => {
      if (quantity <= 0) return previous.filter((line) => line.productId !== productId);
      return previous.map((line) =>
        line.productId === productId ? { ...line, quantity: Math.min(99, quantity) } : line,
      );
    });
  }, []);

  const addToCart = useCallback((productId: string, amount = 1) => {
    if (!UUID.test(productId) || !Number.isInteger(amount) || amount < 1) return;
    setCart((previous) => {
      if (previous.some((line) => line.productId === productId)) {
        return previous.map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.min(99, line.quantity + amount) }
            : line,
        );
      }
      return previous.length >= 20
        ? previous
        : [...previous, { productId, quantity: Math.min(99, amount) }];
    });
    setCartOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((previous) => previous.filter((line) => line.productId !== productId));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);
  const toggleFavorite = useCallback((productId: string) => {
    if (!UUID.test(productId)) return;
    setFavorites((previous) =>
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId].slice(0, 100),
    );
  }, []);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);
  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, line) => sum + (products[line.productId]?.price ?? 0) * line.quantity, 0),
    [cart, products],
  );
  const cartIsValid =
    !cartLoading &&
    !cartError &&
    cart.length > 0 &&
    cart.every(
      (line) =>
        !!products[line.productId] && line.quantity <= products[line.productId].stock_quantity,
    );

  return (
    <ShopContext.Provider
      value={{
        cart,
        products,
        cartLoading,
        cartError,
        favorites,
        cartOpen,
        setCartOpen,
        addToCart,
        setQuantity,
        removeFromCart,
        clearCart,
        toggleFavorite,
        cartCount,
        cartSubtotal,
        cartIsValid,
        refreshCart,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop, ShopProvider içinde kullanılmalıdır.');
  return context;
}
