'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { cartReducer, initialCartState, type CartFeedback } from '@/lib/cart-state';
import { cartLineKey, type CartLine, type CartProduct } from '@/lib/cart-types';

type ShopContextValue = {
  cart: CartLine[];
  products: Record<string, CartProduct>;
  cartLoading: boolean;
  cartError: string;
  favorites: string[];
  couponCode: string;
  setCouponCode: (code: string) => void;
  cartFeedback: CartFeedback | null;
  dismissCartFeedback: () => void;
  addToCart: (productId: string, amount?: number, variantId?: string | null) => void;
  setQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  removeFromCart: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  cartCount: number;
  cartSubtotal: number;
  cartIsValid: boolean;
  refreshCart: () => Promise<void>;
};

const ShopContext = createContext<ShopContextValue | null>(null);
// Keep the original key to preserve non-variant baskets across this upgrade.
const CART_KEY = 'oz-kirtasiye-real-cart-v1';
const FAVORITES_KEY = 'oz-kirtasiye-real-favorites-v1';
const COUPON_KEY = 'oz-kirtasiye-coupon-v1';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function isValidLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.productId === 'string' &&
    UUID.test(line.productId) &&
    (line.variantId == null || (typeof line.variantId === 'string' && UUID.test(line.variantId))) &&
    Number.isInteger(line.quantity) &&
    typeof line.quantity === 'number' &&
    line.quantity >= 1 &&
    line.quantity <= 99
  );
}

function readCart(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .filter((item): item is CartLine => {
        if (!isValidLine(item)) return false;
        const key = cartLineKey(item.productId, item.variantId);
        if (seen.has(key)) return false;
        seen.add(key);
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
  const [{ lines: cart, feedback: cartFeedback }, dispatchCart] = useReducer(
    cartReducer,
    initialCartState,
  );
  const dismissCartFeedback = useCallback(() => dispatchCart({ type: 'dismiss' }), []);
  const [products, setProducts] = useState<Record<string, CartProduct>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');

  useEffect(() => {
    dispatchCart({ type: 'hydrate', lines: readCart() });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate validated browser storage after SSR.
    setFavorites(readFavorites());
    const storedCoupon = window.localStorage.getItem(COUPON_KEY) ?? '';
    if (/^[A-Z0-9_-]{4,32}$/.test(storedCoupon)) setCouponCode(storedCoupon);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, loaded]);
  useEffect(() => {
    if (loaded) window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, loaded]);
  useEffect(() => {
    if (loaded) window.localStorage.setItem(COUPON_KEY, couponCode);
  }, [couponCode, loaded]);

  const cartIdentity = useMemo(
    () =>
      cart
        .map((line) => cartLineKey(line.productId, line.variantId))
        .sort()
        .join(','),
    [cart],
  );
  const loadProducts = useCallback(async (lines: CartLine[], signal?: AbortSignal) => {
    if (!lines.length) {
      setProducts({});
      setCartLoading(false);
      setCartError('');
      return;
    }
    setCartLoading(true);
    setCartError('');
    try {
      const items = lines.map(({ productId, variantId }) => ({
        productId,
        variantId: variantId ?? null,
      }));
      const response = await fetch(
        `/api/cart-items?items=${encodeURIComponent(JSON.stringify(items))}`,
        { cache: 'no-store', signal },
      );
      if (!response.ok) throw new Error('Sepet ürünleri yüklenemedi.');
      const body: { products: CartProduct[] } = await response.json();
      if (signal?.aborted) return;
      setProducts(Object.fromEntries(body.products.map((product) => [product.key, product])));
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the external catalog when cart identity changes.
    void loadProducts(cart, controller.signal);
    return () => controller.abort();
    // Identity changes only when products/variants are added/removed, not when counts change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartIdentity, loaded, loadProducts]);

  const refreshCart = useCallback(() => loadProducts(cart), [cart, loadProducts]);
  const setQuantity = useCallback(
    (productId: string, quantity: number, variantId?: string | null) => {
      dispatchCart({ type: 'quantity', productId, quantity, variantId });
    },
    [],
  );
  const addToCart = useCallback((productId: string, amount = 1, variantId?: string | null) => {
    dispatchCart({ type: 'add', productId, amount, variantId });
  }, []);
  const removeFromCart = useCallback((productId: string, variantId?: string | null) => {
    dispatchCart({ type: 'remove', productId, variantId });
  }, []);
  const clearCart = useCallback(() => {
    dispatchCart({ type: 'clear' });
    setCouponCode('');
  }, []);
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
      cart.reduce(
        (sum, line) =>
          sum + (products[cartLineKey(line.productId, line.variantId)]?.price ?? 0) * line.quantity,
        0,
      ),
    [cart, products],
  );
  const cartIsValid =
    !cartLoading &&
    !cartError &&
    cart.length > 0 &&
    cart.every((line) => {
      const product = products[cartLineKey(line.productId, line.variantId)];
      return !!product && line.quantity <= product.stock_quantity;
    });
  return (
    <ShopContext.Provider
      value={{
        cart,
        products,
        cartLoading,
        cartError,
        favorites,
        couponCode,
        setCouponCode,
        cartFeedback,
        dismissCartFeedback,
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
