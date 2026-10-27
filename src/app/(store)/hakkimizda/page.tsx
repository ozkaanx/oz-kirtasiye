import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, NotebookPen, Sparkles } from 'lucide-react';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = { title: 'Hakkımızda' };
export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const settings = await getStoreSettings();
  return (
    <section className="container-wide legal-page business-about">
      <span className="section-eyebrow">MERHABA, BİZ ÖZ KIRTASİYE</span>
      <h1>
        Renkli fikirlerin adresi<span className="orange-dot">.</span>
      </h1>
      <p className="business-lead">
        Okuldan ofise, yazmaktan üretmeye, oyundan hayal kurmaya… {settings.brand_name} olarak
        İstanbul Bağcılar Güneşli&apos;de kırtasiye ve oyuncak ihtiyaçlarını bir araya getiriyoruz.
      </p>
      <div className="business-value-grid">
        <article>
          <NotebookPen size={27} />
          <h2>Okuldan ofise</h2>
          <p>Defter, kalem ve farklı kırtasiye ihtiyaçlarını tek bir mağazada keşfet.</p>
        </article>
        <article>
          <Sparkles size={27} />
          <h2>Renkli seçimler</h2>
          <p>Günlük işleri kolaylaştıran, yaratıcılığı destekleyen ürünlere odaklanıyoruz.</p>
        </article>
        <article>
          <MapPin size={27} />
          <h2>Güneşli&apos;deyiz</h2>
          <p>Mağazamızı Bağcılar / Güneşli&apos;de ziyaret edebilir, bizimle iletişime geçebilirsin.</p>
        </article>
      </div>
      <div className="business-seller-note">
        <strong>Resmî işletme bilgisi</strong>
        <p>
          Bu mağaza {settings.legal_name} unvanlı gerçek kişi ticari işletmesi tarafından
          işletilmektedir.
        </p>
        <p>{settings.registered_address}</p>
      </div>
      <Link href="/urunler" className="button button-primary">
        Ürünleri keşfet <ArrowRight size={18} />
      </Link>
    </section>
  );
}
