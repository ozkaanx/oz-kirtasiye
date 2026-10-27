import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { getCachedLiveCategories } from '@/lib/cached-catalog';
import '@/components/layout/store-reference.css';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCachedLiveCategories();
  return (
    <>
      <a className="skip-to-content" href="#main-content">
        İçeriğe geç
      </a>
      <Header categories={categories} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer categories={categories} />
      <CartDrawer />
    </>
  );
}
