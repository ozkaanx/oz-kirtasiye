import Link from 'next/link';
import { ArrowUpRight, Heart, MapPin, Sparkles } from 'lucide-react';
import { Logo } from './logo';
import type { StoreCategory } from '@/lib/category-utils';

export function Footer({ categories }: { categories: StoreCategory[] }) {
  return (
    <footer className="site-footer">
      <div className="container-wide">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p>
              Bir defter, bir kalem, binlerce fikir. Okuldan ofise, oyun saatinden hayal kurmaya
              kadar her an yanında.
            </p>
            <div className="footer-place">
              <MapPin size={17} /> Bağcılar / Güneşli, İstanbul
            </div>
          </div>
          <div className="footer-col">
            <h3>Keşfet</h3>
            <Link href="/urunler">Tüm ürünler</Link>
            {categories
              .filter((category) => !category.parent_id)
              .slice(0, 4)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/urunler?category=${encodeURIComponent(category.slug)}`}
                >
                  {category.name}
                </Link>
              ))}
          </div>
          <div className="footer-col">
            <h3>Öz Kırtasiye</h3>
            <Link href="/hakkimizda">Hakkımızda</Link>
            <Link href="/iletisim">İletişim</Link>
            <Link href="/favoriler">Favorilerim</Link>
            <Link href="/sepet">Sepetim</Link>
          </div>
          <div className="footer-col">
            <h3>Yardım ve yasal bilgiler</h3>
            <Link href="/teslimat-iade">Teslimat ve iade</Link>
            <Link href="/on-bilgilendirme">Ön bilgilendirme</Link>
            <Link href="/mesafeli-satis-sozlesmesi">Mesafeli satış sözleşmesi</Link>
            <Link href="/gizlilik">KVKK aydınlatma</Link>
            <Link href="/cerez-politikasi">Çerez politikası</Link>
            <Link className="footer-contact" href="/iletisim">
              İletişime geç <ArrowUpRight size={16} />
            </Link>
            <span className="footer-mini-note">
              <Sparkles size={14} /> Her gün yeni fikirler!
            </span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Öz Kırtasiye. Sevgiyle hazırlandı{' '}
            <Heart size={13} fill="#ff7897" color="#ff7897" />
          </span>
          <span>Renkli fikirlerin buluşma noktası.</span>
        </div>
      </div>
    </footer>
  );
}
