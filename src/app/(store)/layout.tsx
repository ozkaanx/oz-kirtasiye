import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { getLiveCategories } from '@/lib/real-catalog';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await getLiveCategories();
  return (
    <>
      <Header categories={categories} />
      <main id="main-content">{children}</main>
      <Footer categories={categories} />
      <CartDrawer />
    </>
  );
}
