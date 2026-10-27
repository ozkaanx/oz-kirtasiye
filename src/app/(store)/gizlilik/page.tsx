import type { Metadata } from 'next';
import { LegalLayout, LegalSection, SellerDetails } from '@/components/legal/legal-layout';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = { title: 'KVKK Aydınlatma Metni' };
export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const settings = await getStoreSettings();
  return (
    <LegalLayout
      title="KVKK aydınlatma metni"
      eyebrow="KİŞİSEL VERİLERİN KORUNMASI"
      settings={settings}
    >
      <LegalSection title="1. Veri sorumlusu">
        <p>
          Kişisel verilerin işlenmesine ilişkin veri sorumlusu aşağıda bilgileri yer alan
          işletmedir. Bu metin 6698 sayılı KVKK madde 10 kapsamında bilgilendirme amacı taşır.
        </p>
        <SellerDetails settings={settings} />
      </LegalSection>
      <LegalSection title="2. İşlenen veriler ve amaçlar">
        <p>
          Sipariş talebi oluşturduğunda ad soyad, telefon, il, ilçe, açık adres, talep notu ve
          seçtiğin ürün bilgilerini; talebine yanıt verme, ürün/teslimat durumunu görüşme, sipariş
          operasyonu ve olası uyuşmazlıkları yönetme amacıyla kullanırız. Yönetim ekranında talep ve
          işlem geçmişi saklanır.
        </p>
        <p>
          Sepet ve favoriler için tarayıcının yerel depolama alanında ürün kimlikleri ve adet
          bilgileri tutulur. Kart numarası veya kart güvenlik kodu bu sipariş talebi formunda
          toplanmaz.
        </p>
      </LegalSection>
      <LegalSection title="3. Hukukî sebepler, aktarım ve saklama">
        <p>
          Talebin değerlendirilmesi kapsamındaki veri işleme, somut duruma göre sözleşmenin
          kurulması veya ifasıyla doğrudan ilgili olma, hukuki yükümlülük ve meşru menfaat şartları
          kapsamında değerlendirilebilir. Kesin hukukî sebepler ve veri saklama süreleri canlı
          faaliyetler ve muhasebe yükümlülüklerine göre işletme tarafından belirlenmelidir.
        </p>
        <p>
          Veriler, gerekli olduğu ölçüde barındırma/altyapı hizmet sağlayıcıları ve sipariş
          tamamlanırsa lojistik veya mevzuat gerektiren resmî makamlarla paylaşılabilir. PayTR henüz
          aktif olmadığından bu sürümde PayTR&apos;a kart bilgisi aktarılmamaktadır. Yurt dışına aktarım
          durumları ve gerekli tedbirler canlıya çıkmadan incelenmelidir.
        </p>
      </LegalSection>
      <LegalSection title="4. İlgili kişinin hakları">
        <p>
          KVKK madde 11 kapsamında verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme,
          düzeltme, silme/yok etme şartlarını sorma ve kanundaki diğer haklarını kullanma imkanın
          bulunur. Başvuru kanalı ve kimlik doğrulama usulü işletme iletişim bilgileri tamamlanınca
          bu sayfada netleştirilecektir.
        </p>
      </LegalSection>
      <LegalSection title="5. Aydınlatma ve pazarlama izni farklıdır">
        <p>
          Bu metni okuduğunu belirtmen, reklam mesajları veya kampanya bildirimleri almak için açık
          rıza verdiğin anlamına gelmez. Pazarlama izni gerekiyorsa ayrıca ve isteğe bağlı
          alınmalıdır.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
