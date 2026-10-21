import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Kişisel Veri Bilgilendirmesi' };

export default function DataInformationPage() {
  return (
    <main className="container-wide privacy-page">
      <h1>Kişisel veri bilgilendirmesi</h1>
      <p>
        Öz Kırtasiye sipariş talebi formunda paylaştığınız ad soyad, telefon, şehir, ilçe, teslimat
        adresi ve isteğe bağlı not bilgileri; talebinizin alınması, size ulaşılması, ürün ve
        teslimat seçeneklerinin görüşülmesi amacıyla işlenir.
      </p>
      <p>
        Bu bilgiler mağaza yönetimi tarafından sipariş talebinin takibi için kullanılır. Bu sayfa
        temel bir bilgilendirme taslağıdır; işletmenin tam ticari unvanı, iletişim kanalları, hukuki
        dayanaklar, saklama süresi, alıcı grupları, başvuru yolları ve haklarınızla ilgili ayrıntılı
        KVKK aydınlatma metni yayına alınmadan önce tamamlanmalıdır.
      </p>
      <p>Online ödeme bu sürümde sunulmaz ve kart bilgisi alınmaz.</p>
      <Link href="/siparis" className="button button-outline">
        Sipariş talebine dön
      </Link>
    </main>
  );
}
