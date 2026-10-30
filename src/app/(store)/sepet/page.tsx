import type { Metadata } from 'next';
import { CartPage } from '@/components/cart/cart-page';
import { CartRecommendations } from '@/components/product/cart-recommendations';
import { getStoreSettings } from '@/lib/store-settings';
export const metadata: Metadata = { title: 'Sepetim', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function Page() {
  return (
    <>
      <CartPage
        settings={await getStoreSettings()}
        requestsEnabled={process.env.ORDER_REQUESTS_ENABLED === 'true'}
      />
      <div className="container-wide">
        <CartRecommendations />
      </div>
    </>
  );
}
