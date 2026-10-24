import type { Metadata } from 'next';
import { LegalLayout, LegalSection } from '@/components/legal/legal-layout';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = { title: 'Teslimat, İptal ve İade' };
export const dynamic = 'force-dynamic';

export default async function DeliveryAndReturnsPage() {
  const settings = await getStoreSettings();
  return (
    <LegalLayout
      title="Teslimat, iptal ve iade"
      eyebrow="ALIŞVERİŞ SONRASI DESTEK"
      settings={settings}
    >
      <LegalSection title="Teslimat bilgileri">
        <p>
          Şu an online ödeme yerine sipariş talebi alınıyor. Kargo veya mağazadan teslim seçenekleri
          yönetim panelinde açıldığında talep formunda seçilebilir; varsa sabit kargo bedeli ve
          tahmini toplam gönderim öncesinde gösterilir. Ödeme ve kesin teslimat taahhütleri ayrıca
          netleştirilir. Canlı ödemeye geçildiğinde tüm teslimat ücretleri ve taahhüt edilen süre
          ödeme öncesinde gösterilecektir.
        </p>
        <p>
          {settings.shipping_information ||
            'İşletmenin kargo anlaşması ve teslimat koşulları henüz tanımlanmadı.'}
        </p>
      </LegalSection>
      <LegalSection title="İptal">
        <p>
          Henüz işleme alınmamış talebinin iptali için mağazayla iletişime geçebilirsin. Bir ödeme
          tahsil edilmediyse parasal iade söz konusu olmaz. Ödeme altyapısı açıldığında ödeme
          iptalleri sağlayıcı kayıtlarıyla da eşleştirilecektir.
        </p>
      </LegalSection>
      <LegalSection title="Cayma hakkı">
        <p>
          Mesafeli satışlarda tüketici, kural olarak malı teslim aldığı tarihten itibaren 14 gün
          içinde gerekçe göstermeden cayma hakkını kullanabilir. Tüketicinin korunmasına ilişkin
          mevzuattaki istisnalar ve özel durumlar saklıdır. Bildirimin yazılı veya kalıcı veri
          saklayıcısıyla yapılması mümkündür.
        </p>
      </LegalSection>
      <LegalSection title="İade gönderimi">
        <p>
          İade talebinde bulunmadan önce sipariş referans numaranı ve ürün bilgilerini iletmen
          sürecin izlenmesini kolaylaştırır. İade masrafları ve geri ödeme takvimi yürürlükteki
          mevzuata uygun olarak uygulanır; ödeme yapan müşteriye yasal süresi içinde uygun yöntemle
          iade yapılır.
        </p>
        <p>
          İade adresi:{' '}
          {settings.return_address || 'İade adresi henüz yönetim panelinde tanımlanmadı.'}
        </p>
        <p>
          {settings.return_instructions ||
            'İade taşıyıcısı ve gönderim talimatları henüz belirlenmedi.'}
        </p>
      </LegalSection>
      <LegalSection title="Ayıplı ürünler">
        <p>
          Ayıplı mala ilişkin seçimlik hakların ve yasal başvuru yollarının kullanılmasında tüketici
          mevzuatı geçerlidir.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
