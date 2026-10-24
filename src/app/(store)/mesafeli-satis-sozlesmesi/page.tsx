import type { Metadata } from 'next';
import { LegalLayout, LegalSection, SellerDetails } from '@/components/legal/legal-layout';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = { title: 'Mesafeli Satış Sözleşmesi Taslağı' };
export const dynamic = 'force-dynamic';

export default async function DistanceSalesAgreementPage() {
  const settings = await getStoreSettings();
  return (
    <LegalLayout
      title="Mesafeli satış sözleşmesi"
      eyebrow="SATIŞ VE TESLİMAT KOŞULLARI"
      settings={settings}
    >
      <LegalSection title="1. Taraflar">
        <p>
          Satıcı bilgileri aşağıdadır. Alıcı bilgileri gelecekteki ödeme aşamasında alıcının girdiği
          kimlik ve teslimat bilgileriyle belirlenecektir.
        </p>
        <SellerDetails settings={settings} />
      </LegalSection>
      <LegalSection title="2. Sözleşmenin konusu">
        <p>
          Bu metin, satıcıya ait internet sitesinde listelenen ürünlerin mesafeli satışı ve teslimi
          için ileride kullanılacak sözleşme taslağıdır. Ürün, adet, vergiler dahil bedel ve varsa
          kargo tutarı sipariş onayında ayrıca gösterilecektir. Şu anki “sipariş talebi” formu,
          satış sözleşmesinin kurulduğu veya ödeme yapıldığı anlamına gelmez.
        </p>
      </LegalSection>
      <LegalSection title="3. Ödeme ve teslimat">
        <p>
          Online ödeme ve teslimat yöntemleri henüz açılmamıştır. Canlı satışta teslimat süresi,
          yöntemi, taşıyıcı bilgileri ve varsa ilave masraflar ön bilgilendirme ile sipariş özetinde
          açıklanacaktır.
        </p>
        <p>
          {settings.shipping_information ||
            'Kargo/teslimat koşulları yönetici tarafından doldurulacaktır.'}
        </p>
      </LegalSection>
      <LegalSection title="4. Cayma ve iadeler">
        <p>
          Tüketicinin yasal cayma ve ayıplı mala ilişkin hakları saklıdır. Kural olarak mal
          tesliminden itibaren 14 gün içinde cayma hakkı kullanılabilir; mevzuatın öngördüğü
          istisnalar geçerlidir. Başvuru yöntemi, anlaşmalı taşıyıcı ve iade adresi yayına çıkıştan
          önce netleştirilecektir.
        </p>
        <p>İade adresi: {settings.return_address || 'Henüz tanımlanmadı.'}</p>
      </LegalSection>
      <LegalSection title="5. Uyuşmazlıklar ve başvuru">
        <p>
          Uyuşmazlık durumunda tüketici mevzuatındaki başvuru yolları geçerlidir. Bu metnin canlı
          sözleşme haline gelmesi için satıcının operasyonu, güncel mevzuat ve ödeme adımıyla uyumu
          ayrıca hukukî incelemeye tabi tutulmalıdır.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
