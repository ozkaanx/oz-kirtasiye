import Link from 'next/link';
import { MapPin, MessageCircle, ArrowRight } from 'lucide-react';
export default function Page() {
  return (
    <div className="container-wide simple-page text-page">
      <span className="section-eyebrow">BİZE ULAŞIN</span>
      <h1>
        Bir merhaba de<span className="orange-dot">.</span>
      </h1>
      <p>
        Mağazamızda seni görmekten mutluluk duyarız. Telefon, WhatsApp, açık adres ve çalışma
        saatleri doğrulandığında bu sayfaya eklenecektir.
      </p>
      <div className="contact-tile">
        <MapPin size={25} />
        <div>
          <strong>Öz Kırtasiye</strong>
          <span>Bağcılar, Güneşli / İstanbul</span>
        </div>
      </div>
      <div className="contact-tile">
        <MessageCircle size={25} />
        <div>
          <strong>Destek</strong>
          <span>İletişim kanalları henüz tanımlanmadı.</span>
        </div>
      </div>
      <Link href="/" className="button button-outline">
        Ana sayfaya dön <ArrowRight size={17} />
      </Link>
    </div>
  );
}
