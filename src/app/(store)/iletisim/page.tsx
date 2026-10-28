import type { Metadata } from 'next';
import { absoluteStoreUrl } from '@/lib/seo';
import Link from 'next/link';
import { ArrowRight, Clock3, Mail, MapPin, Phone } from 'lucide-react';
import { getStoreSettings } from '@/lib/store-settings';
import { supportPhoneHref } from '@/lib/store-profile';

const description = 'Öz Kırtasiye Bağcılar Güneşli mağaza bilgileri, adresi ve iletişim kanallarına ulaşın.';
export const metadata: Metadata = {
  title: 'İletişim',
  description,
  ...(absoluteStoreUrl('/iletisim') ? { alternates: { canonical: '/iletisim' } } : {}),
  openGraph: { title: 'İletişim', description, type: 'website' },
};
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const settings = await getStoreSettings();
  return (
    <section className="container-wide legal-page business-contact">
      <span className="section-eyebrow">BİZE ULAŞIN</span>
      <h1>
        Bir merhaba de<span className="orange-dot">.</span>
      </h1>
      <p className="business-lead">
        Ürünler, sipariş talepleri veya mağazamızla ilgili soruların için bize ulaşabilirsin.
      </p>
      <div className="business-contact-grid">
        <article>
          <MapPin size={24} />
          <h2>Mağaza ve işletme adresi</h2>
          <p>{settings.registered_address}</p>
          <small>{settings.legal_name}</small>
        </article>
        <article>
          <Phone size={24} />
          <h2>Telefon</h2>
          {settings.support_phone ? (
            <a href={supportPhoneHref(settings.support_phone)}>{settings.support_phone}</a>
          ) : (
            <p>Telefon bilgisi henüz eklenmedi.</p>
          )}
        </article>
        <article>
          <Mail size={24} />
          <h2>E-posta</h2>
          {settings.support_email ? (
            <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a>
          ) : (
            <p>E-posta adresi henüz eklenmedi.</p>
          )}
        </article>
        <article>
          <Clock3 size={24} />
          <h2>Çalışma saatleri</h2>
          <p>{settings.business_hours || 'Çalışma saatleri henüz eklenmedi.'}</p>
        </article>
      </div>
      <p className="business-contact-hint">
        İptal, iade ve tüketici başvuruları için ilgili iletişim kanalları mağaza yönetimi
        tarafından doğrulanarak yayınlanacaktır.
      </p>
      <Link href="/" className="button button-outline">
        Ana sayfaya dön <ArrowRight size={17} />
      </Link>
    </section>
  );
}
