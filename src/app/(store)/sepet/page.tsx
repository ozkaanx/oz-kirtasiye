import type { Metadata } from 'next';
import { CartPage } from '@/components/cart/cart-page';
import { getStoreSettings } from '@/lib/store-settings';
export const metadata: Metadata = { title: 'Sepetim' };
export const dynamic = 'force-dynamic';
export default async function Page() {
  return <CartPage settings={await getStoreSettings()} />;
}
