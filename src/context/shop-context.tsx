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
import { getProductById } from '@/data/catalog';
import type { CartLine } from '@/types/shop';

interface ShopContextValue {
  cart: CartLine[];
  favorites: string[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  toggleFavorite: (productId: string) => void;
  cartCount: number;
  cartSubtotal: number;
}

const ShopContext = createContext<ShopContextValue | null>(null);
const CART_KEY = 'oz-kirtasiye-demo-cart-v1';
const FAVORITES_KEY = 'oz-kirtasiye-demo-favorites-v1';

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        !!line &&
        typeof line === 'object' &&
        typeof line.productId === 'string' &&
        !!getProductById(line.productId) &&
        Number.isInteger(line.quantity) &&
        line.quantity > 0 &&
        line.quantity <= 99,
    );
  } catch {
    return [];
  }
}

function readFavorites(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && !!getProductById(id));
  } catch {
    return [];
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (!getProductById(productId)) return;
    setCart((previous) =>
      quantity <= 0
        ? previous.filter((line) => line.productId !== productId)
        : previous.some((line) => line.productId === productId)
          ? previous.map((line) =>
              line.productId === productId ? { ...line, quantity: Math.min(99, quantity) } : line,
            )
          : [...previous, { productId, quantity: Math.min(99, quantity) }],
    );
  }, []);

  const addToCart = useCallback((productId: string) => {
    if (!getProductById(productId)) return;
    setCart((previous) =>
      previous.some((line) => line.productId === productId)
        ? previous.map((line) =>
            line.productId === productId
              ? { ...line, quantity: Math.min(99, line.quantity + 1) }
              : line,
          )
        : [...previous, { productId, quantity: 1 }],
    );
    setCartOpen(true);
  }, []);

  const removeFromCart = useCallback(
    (productId: string) =>
      setCart((previous) => previous.filter((line) => line.productId !== productId)),
    [],
  );
  const toggleFavorite = useCallback((productId: string) => {
    if (!getProductById(productId)) return;
    setFavorites((previous) =>
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId],
    );
  }, []);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);
  const cartSubtotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + (getProductById(line.productId)?.price ?? 0) * line.quantity,
        0,
      ),
    [cart],
  );

  return (
    <ShopContext.Provider
      value={{
        cart,
        favorites,
        cartOpen,
        setCartOpen,
        addToCart,
        setQuantity,
        removeFromCart,
        toggleFavorite,
        cartCount,
        cartSubtotal,
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
