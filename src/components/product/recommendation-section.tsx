import type { LiveProduct } from '@/lib/real-catalog';
import { LiveProductCard } from '@/components/product/live-product-card';
import styles from './recommendation-section.module.css';

export function RecommendationSection({ title, products }: { title: string; products: LiveProduct[] }) {
  if (!products.length) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.heading}><span className="section-eyebrow">BUNLARI DA KEŞFET</span><h2>{title}</h2></div>
      <div className={styles.grid}>
        {products.map((product) => <LiveProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
