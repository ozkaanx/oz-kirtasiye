import type { Metadata } from 'next';
import { CartPage } from '@/components/cart/cart-page';
export const metadata: Metadata = { title: 'Sepetim' };
export default function Page() {
  return <CartPage />;
}
