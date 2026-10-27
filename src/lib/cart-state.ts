import { cartLineKey, type CartLine } from './cart-types.ts';

export type CartFeedback =
  { kind: 'success'; quantity: number } | { kind: 'error'; message: string };
export type CartState = { lines: CartLine[]; feedback: CartFeedback | null };
export type CartAction =
  | { type: 'hydrate'; lines: CartLine[] }
  | { type: 'add'; productId: string; variantId?: string | null; amount: number }
  | { type: 'quantity'; productId: string; variantId?: string | null; quantity: number }
  | { type: 'remove'; productId: string; variantId?: string | null }
  | { type: 'clear' }
  | { type: 'dismiss' };
export const initialCartState: CartState = { lines: [], feedback: null };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Apply the cart change and its feedback atomically; a rejected addition must never report success. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === 'hydrate') return { lines: action.lines, feedback: null };
  if (action.type === 'dismiss') return { ...state, feedback: null };
  if (action.type === 'clear') return initialCartState;
  if (!uuid.test(action.productId) || (action.variantId != null && !uuid.test(action.variantId)))
    return state;
  const key = cartLineKey(action.productId, action.variantId);
  const matches = (line: CartLine) => cartLineKey(line.productId, line.variantId) === key;
  if (action.type === 'remove')
    return { ...state, lines: state.lines.filter((line) => !matches(line)) };
  if (action.type === 'quantity') {
    if (!Number.isInteger(action.quantity)) return state;
    return {
      ...state,
      lines:
        action.quantity <= 0
          ? state.lines.filter((line) => !matches(line))
          : state.lines.map((line) =>
              matches(line) ? { ...line, quantity: Math.min(99, action.quantity) } : line,
            ),
    };
  }
  if (!Number.isInteger(action.amount) || action.amount < 1) return state;
  const existing = state.lines.find(matches);
  if (!existing && state.lines.length >= 20)
    return {
      ...state,
      feedback: {
        kind: 'error',
        message: 'Sepetinde en fazla 20 farklı ürün veya seçenek bulunabilir.',
      },
    };
  const previous = existing?.quantity ?? 0;
  const quantity = Math.min(99, previous + action.amount);
  if (quantity === previous)
    return {
      ...state,
      feedback: { kind: 'error', message: 'Bu ürün veya seçenek için 99 adet sınırına ulaştın.' },
    };
  return {
    lines: existing
      ? state.lines.map((line) => (matches(line) ? { ...line, quantity } : line))
      : [
          ...state.lines,
          { productId: action.productId, variantId: action.variantId ?? null, quantity },
        ],
    feedback: { kind: 'success', quantity: quantity - previous },
  };
}
