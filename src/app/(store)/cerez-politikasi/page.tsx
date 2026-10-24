import type { Metadata } from 'next';
import { LegalLayout, LegalSection } from '@/components/legal/legal-layout';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = { title: 'Çerez ve Yerel Depolama Politikası' };
export const dynamic = 'force-dynamic';

export default async function CookiesPage() {
  const settings = await getStoreSettings();
  return (
    <LegalLayout title="Çerez ve yerel depolama" eyebrow="DİJİTAL GİZLİLİK" settings={settings}>
      <LegalSection title="Sepet ve favoriler">
        <p>
          Sitenin mevcut sürümünde sepet ve favori seçimleri tarayıcıdaki yerel depolamada (
          <code>localStorage</code>) tutulur. Bu kayıtlarda ürün kimlikleri ile adet bilgileri
          bulunur; ödeme kartı bilgileri tutulmaz. Tarayıcı verilerini temizleyerek bu kayıtları
          silebilirsin.
        </p>
      </LegalSection>
      <LegalSection title="Oturum çerezleri">
        <p>
          Yönetici oturumunun sürdürülebilmesi için kimlik doğrulama altyapısı çerezler
          kullanabilir. Bu çerezler oturum ve güvenlik işlevleri için gereklidir.
        </p>
      </LegalSection>
      <LegalSection title="Analitik ve reklam çerezleri">
        <p>
          Bu metin, mevcut kodda doğruladığımız yerel depolama ve oturum işleyişini açıklar. İleride
          Google Analytics, Meta Pixel veya başka reklam/ölçüm araçları eklenirse, çerez envanteri
          ile uygun izin yönetimi canlıya alınmadan önce ayrıca hazırlanmalıdır.
        </p>
      </LegalSection>
      <LegalSection title="Tarayıcı kontrolü">
        <p>
          Çerez ve yerel depolama ayarlarını tarayıcının gizlilik bölümünden yönetebilirsin. Zorunlu
          oturum çerezlerinin engellenmesi bazı oturum açma işlevlerini etkileyebilir.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
