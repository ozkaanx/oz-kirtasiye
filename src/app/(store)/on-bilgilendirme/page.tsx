import type { Metadata } from 'next';
import { LegalLayout, LegalSection, SellerDetails } from '@/components/legal/legal-layout';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = { title: 'Ön Bilgilendirme' };
export const dynamic = 'force-dynamic';

export default async function PreInformationPage() {
  const settings = await getStoreSettings();
  return (
    <LegalLayout title="Ön bilgilendirme" eyebrow="ALIŞVERİŞ ÖNCESİ" settings={settings}>
      <LegalSection title="Satıcı ve iletişim bilgileri">
        <SellerDetails settings={settings} />
      </LegalSection>
      <LegalSection title="Ürünler ve fiyat">
        <p>
          Ürünlerin temel nitelikleri, satış fiyatı ve stok durumu ilgili ürün sayfalarında
          gösterilir. Sipariş talebindeki tahmini toplam, seçilen yönteme göre ürün ara toplamı ve
          yapılandırılmış kargo bedelini içerir. Kesin tutar talep oluşturulurken sunucuda yeniden
          hesaplanır. İlave bedeller tüketiciye açıkça bildirilmeden tahsil edilemez.
        </p>
      </LegalSection>
      <LegalSection title="Mevcut sipariş talebi akışı">
        <p>
          Öz Kırtasiye&apos;nin mevcut formu henüz online ödeme veya kesin satış işlemi değildir. Sipariş
          talebinde bulunulduğunda ödeme alınmaz, stok ayrılmaz. İşletme müşteriyle iletişime
          geçerek teslimat ve ödeme koşullarını ayrıca netleştirir.
        </p>
      </LegalSection>
      <LegalSection title="Planlanan online satış ve teslimat">
        <p>
          PayTR ile online satış açılmadan önce ürün toplamı, uygulanacak tüm vergiler,
          kargo/teslimat masrafları, ödeme şartları ve teslim süresi ödeme öncesinde tüketiciye
          ayrıca sunulacaktır.
        </p>
        <p>
          Mevcut kargo/teslimat bilgisi:{' '}
          {settings.shipping_information ||
            'Kargo firması, ücret ve taahhüt edilen teslim süresi henüz tanımlanmadı.'}
        </p>
      </LegalSection>
      <LegalSection title="Cayma hakkı ve başvuru">
        <p>
          Mesafeli satışlarda tüketicilerin kural olarak teslimden itibaren 14 günlük cayma hakkı
          vardır; mevzuatta belirlenen istisnalar uygulanabilir. Cayma ve iade başvurularına ilişkin
          ayrıntılar <a href="/teslimat-iade">Teslimat ve İade</a> sayfasında yer alır.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
