import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { OrderRequestResult } from '@/lib/cart-types';
export function CheckoutCompleted({ result: completed }: { result: OrderRequestResult }) {
  return (
    <section className="container-wide checkout-finished">
      <CheckCircle2 size={62} />
      <h1>Talebin kaydedildi!</h1>
      <p>
        Talep numaran <strong>{completed.reference}</strong>. Mağazamız seninle iletişime geçerek
        hazırlık ve ödeme seçeneklerini netleştirecek.
      </p>
      <p>
        <strong>
          {completed.deliveryMethod === 'pickup' ? 'Mağazadan teslim' : 'Kargo teslimatı'}
        </strong>{' '}
        · Ürünler: {formatPrice(completed.subtotal)}{' '}
        {completed.discountAmount > 0 && (
          <>
            · {completed.couponCode ? 'Kupon' : 'Kampanya'} indirimi: −
            {formatPrice(completed.discountAmount)}{' '}
          </>
        )}
        · Kargo: {formatPrice(completed.shippingFee)} ·{' '}
        <strong>Toplam: {formatPrice(completed.total)}</strong>
      </p>
      <p>
        <strong>Henüz ödeme alınmadı ve stok ayrılmadı.</strong>
      </p>
      <Link className="button button-primary" href="/urunler">
        Alışverişe devam et <ArrowRight size={17} />
      </Link>
    </section>
  );
}
