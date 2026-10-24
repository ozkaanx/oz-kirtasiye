import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { storeDetailsMissing, type StoreSettings } from '@/lib/store-profile';

export function LegalLayout({
  title,
  eyebrow,
  settings,
  children,
  draft = true,
}: {
  title: string;
  eyebrow: string;
  settings: StoreSettings;
  children: ReactNode;
  draft?: boolean;
}) {
  const missing = storeDetailsMissing(settings);
  return (
    <section className="container-wide legal-page">
      <Link href="/" className="legal-back">
        <ArrowLeft size={15} /> Mağazaya dön
      </Link>
      <div className="legal-header">
        <span className="section-eyebrow">{eyebrow}</span>
        <h1>
          {title}
          <span className="orange-dot">.</span>
        </h1>
        <p>
          Satıcı: <strong>{settings.legal_name}</strong> · {settings.brand_name}
        </p>
      </div>
      {draft && (
        <div className="legal-draft-banner" role="note">
          <AlertCircle size={20} />
          <span>
            <strong>Yayın öncesi hukukî kontrol gerekli.</strong> Bu sayfa işletme için hazırlanmış
            bir taslaktır; canlı satışa geçmeden önce teslimat, masraflar, iletişim ve iade
            süreçlerine göre onaylanmalıdır.
            {missing.length > 0 && <> Eksik işletme bilgileri: {missing.join(', ')}.</>}
          </span>
        </div>
      )}
      <div className="legal-body">{children}</div>
      <div className="legal-endnote">
        <ShieldCheck size={19} /> Soruların için <Link href="/iletisim">iletişim sayfamızı</Link>{' '}
        ziyaret edebilirsin.
      </div>
      <nav className="legal-related" aria-label="Yasal metinler">
        <Link href="/on-bilgilendirme">Ön bilgilendirme</Link>
        <Link href="/mesafeli-satis-sozlesmesi">Mesafeli satış</Link>
        <Link href="/teslimat-iade">Teslimat ve iade</Link>
        <Link href="/gizlilik">KVKK</Link>
        <Link href="/cerez-politikasi">Çerezler</Link>
      </nav>
    </section>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function SellerDetails({ settings }: { settings: StoreSettings }) {
  return (
    <dl className="legal-details">
      <div>
        <dt>Mağaza adı</dt>
        <dd>{settings.brand_name}</dd>
      </div>
      <div>
        <dt>Resmî satıcı unvanı</dt>
        <dd>{settings.legal_name}</dd>
      </div>
      <div>
        <dt>Adres</dt>
        <dd>{settings.registered_address}</dd>
      </div>
      <div>
        <dt>Vergi numarası</dt>
        <dd>{settings.tax_number || 'Henüz girilmedi'}</dd>
      </div>
      <div>
        <dt>Vergi dairesi</dt>
        <dd>{settings.tax_office || 'Henüz girilmedi'}</dd>
      </div>
      <div>
        <dt>MERSİS</dt>
        <dd>{settings.mersis_number || 'Henüz girilmedi'}</dd>
      </div>
      <div>
        <dt>Telefon</dt>
        <dd>{settings.support_phone || 'Henüz girilmedi'}</dd>
      </div>
      <div>
        <dt>E-posta</dt>
        <dd>{settings.support_email || 'Henüz girilmedi'}</dd>
      </div>
    </dl>
  );
}
