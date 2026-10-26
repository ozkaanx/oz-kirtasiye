'use client';

import { useEffect, useMemo, useState } from 'react';
import { useShop } from '@/context/shop-context';
import type { LiveProduct } from '@/lib/real-catalog';
import { LiveProductCard } from '@/components/product/live-product-card';
import styles from './recommendation-section.module.css';

export function CartRecommendations() {
  const { cart } = useShop();
  const ids = useMemo(() => [...new Set(cart.map((item) => item.productId))].sort().join(','), [cart]);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    fetch(`/api/recommendations?ids=${encodeURIComponent(ids)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { products: [] })
      .then((result: { products?: LiveProduct[] }) => { if (!controller.signal.aborted) setProducts(result.products ?? []); })
      .catch(() => { if (!controller.signal.aborted) setProducts([]); });
    return () => controller.abort();
  }, [ids]);
  if (!ids || !products.length) return null;
  return <section className={styles.section} aria-label="Sepetini tamamla">
    <div className={styles.heading}><span className="section-eyebrow">ALIŞVERİŞE DEVAM</span><h2>Sepetini tamamla</h2></div>
    <div className={styles.grid}>{products.map((product) => <LiveProductCard key={product.id} product={product} />)}</div>
  </section>;
}
