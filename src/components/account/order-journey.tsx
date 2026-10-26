import Link from 'next/link';
import { CheckCircle2, Clock3, Package, Truck, Star, ShoppingBag } from 'lucide-react';
import type { CustomerOrder } from '@/lib/customer';
import styles from './order-journey.module.css';

const phases = [
  { label: 'Talep alındı', icon: Clock3 },
  { label: 'Hazırlanıyor', icon: Package },
  { label: 'Kargoda', icon: Truck },
  { label: 'Teslim edildi', icon: CheckCircle2 },
] as const;
const stage: Record<string, number> = {
  new: 0, contacted: 0, processing: 1, shipped: 2, delivered: 3, completed: 3,
};
function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function OrderJourney({ order }: { order: CustomerOrder }) {
  const isPickup = order.delivery_method === 'pickup';
  const cancelled = order.status === 'cancelled';
  const steps = isPickup ? [phases[0], phases[1], { label: 'Mağazadan teslim', icon: CheckCircle2 }] : [...phases];
  const active = Math.min(stage[order.status] ?? 0, steps.length - 1);
  return (
    <section className={styles.box} aria-label={`Sipariş ${order.reference} durum takibi`}>
      {cancelled ? <p className={styles.cancelled}>Sipariş talebi iptal edildi. İşlem ayrıntıları için mağazayla iletişime geçebilirsiniz.</p> : (
        <ol className={styles.steps}>
          {steps.map(({ label, icon: Icon }, index) => (
            <li key={label} className={index <= active ? styles.done : styles.waiting} aria-current={index === active ? 'step' : undefined}>
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
            </li>
          ))}
        </ol>
      )}
      <div className={styles.details}>
        <span>Talep tarihi: {formatDate(order.created_at)}</span>
        {order.shipped_at && <span>Kargoya verildi: {formatDate(order.shipped_at)}</span>}
        {order.delivered_at && <span>Teslim edildi: {formatDate(order.delivered_at)}</span>}
        {!isPickup && (order.carrier || order.tracking_number) && (
          <span>Kargo: {order.carrier || 'Firma belirtilmedi'}{order.tracking_number ? ` · Takip no: ${order.tracking_number}` : ''}</span>
        )}
      </div>
      {(order.status === 'delivered' || order.status === 'completed') && (
        <div className={styles.actions}>
          <Link href="/urunler"><Star size={15} /> Satın aldığın ürünleri değerlendir</Link>
          <Link href="/urunler"><ShoppingBag size={15} /> Yeniden alışveriş yap</Link>
        </div>
      )}
      <Link className={styles.notifications} href="/hesabim/bildirimler">Sipariş bildirimlerini görüntüle</Link>
      <small className={styles.hint}>Gösterilen adımlar siparişin güncel durumuna dayanır. Gerçekleşmemiş adımların tarihi gösterilmez.</small>
    </section>
  );
}
