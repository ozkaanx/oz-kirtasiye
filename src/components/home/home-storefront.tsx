'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Headphones,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { LiveProductCard } from '@/components/product/live-product-card';
import { categoryArtwork, categoryColor, type StoreCategory } from '@/lib/category-utils';
import type { LiveProduct } from '@/lib/real-catalog';

const campaignCards = [
  {
    eyebrow: 'YENİ SEZON',
    title: 'Okula dönüş\nfırsatları',
    description: 'Yeni döneme rengârenk başla.',
    image: '/illustrations/bag.svg',
    tone: 'campaign-sky',
  },
  {
    eyebrow: 'OYUN ZAMANI',
    title: 'Oyuncakta\neğlenceli seçimler',
    description: 'Minik hayallere büyük oyunlar.',
    image: '/illustrations/blocks.svg',
    tone: 'campaign-peach',
  },
  {
    eyebrow: 'İLHAM AL',
    title: 'Renklerini\nözgür bırak',
    description: 'Sanat ve hobi ürünlerini keşfet.',
    image: '/illustrations/paints.svg',
    tone: 'campaign-mint',
  },
];

type Props = {
  featuredByCategory: Record<string, LiveProduct[]>;
  newestProducts: LiveProduct[];
  categories: StoreCategory[];
};

export function HomeStorefront({ featuredByCategory, newestProducts, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState('all');
  const featuredIds = new Set((featuredByCategory.all ?? []).map((product) => product.id));
  const distinctNewProducts = newestProducts.filter((product) => !featuredIds.has(product.id));
  const topCategories = categories.filter((category) => !category.parent_id).slice(0, 6);
  const featuredProducts = featuredByCategory[activeCategory] ?? [];

  return (
    <>
      <section className="container-wide hero-section" aria-label="Yeni sezon kırtasiye ürünleri">
        <div className="hero-content">
          <span className="hero-eyebrow">
            <span className="tiny-dot" /> YENİ SEZON · YENİ HEYECAN
          </span>
          <h1>
            Renkli fikirler,
            <br />
            mutlu başlangıçlar<span className="orange-dot">.</span>
          </h1>
          <p>
            Kırtasiye, oyuncak ve okul ihtiyaçlarında aradığın her şey Öz Kırtasiye’de. Yeni
            fikirlere yer aç!
          </p>
          <div className="hero-buttons">
            <Link href="#urunler" className="button button-primary">
              Ürünleri keşfet <ArrowRight size={18} />
            </Link>
            <Link href="#kategoriler" className="button button-outline">
              Kategoriler <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="hero-subnote">
            <Sparkles size={16} /> Her günün biraz daha renkli olsun.
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-glow" />
          <Image
            src="/illustrations/hero-scene.svg"
            width={670}
            height={550}
            priority
            alt="Defter, renkli kalemler ve kırtasiye malzemeleri illüstrasyonu"
          />
          <span className="hero-note">
            Yeni fikirler burada! <span>✳</span>
          </span>
        </div>
      </section>

      <section className="container-wide trust-strip" aria-label="Mağaza avantajları">
        <div>
          <PackageCheck size={24} />
          <span>
            <strong>Rengârenk seçenekler</strong>
            <small>Okuldan oyuna her şey</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={24} />
          <span>
            <strong>Özenli alışveriş</strong>
            <small>Kolayca keşfet ve seç</small>
          </span>
        </div>
        <div>
          <Headphones size={24} />
          <span>
            <strong>Biz buradayız</strong>
            <small>Soruların için bize ulaş</small>
          </span>
        </div>
        <div>
          <MapPin size={24} />
          <span>
            <strong>Mahallenin kırtasiyesi</strong>
            <small>Bağcılar · Güneşli</small>
          </span>
        </div>
      </section>

      <section className="container-wide categories-section" id="kategoriler">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">BİRLİKTE KEŞFEDELİM</span>
            <h2>
              Kategorileri keşfet<span className="orange-dot">.</span>
            </h2>
            <p>Aradığını bulmanın en renkli yolu.</p>
          </div>
          <Link href="/urunler" className="text-link">
            Tüm ürünler <ArrowRight size={17} />
          </Link>
        </div>
        {topCategories.length ? (
          <div className="category-grid">
            {topCategories.map((category, index) => (
              <Link
                className="category-card"
                key={category.id}
                href={`/urunler?category=${encodeURIComponent(category.slug)}`}
              >
                <div className="category-picture" style={{ backgroundColor: categoryColor(index) }}>
                  <Image src={categoryArtwork(category)} width={180} height={160} alt="" />
                </div>
                <h3>{category.name}</h3>
                <span className="category-link">
                  Keşfet <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="store-empty-note">Kategorilerimiz çok yakında burada olacak.</p>
        )}
      </section>

      <section className="container-wide campaigns-grid" aria-label="Keşif alanları">
        {campaignCards.map((item) => {
          const keywords =
            item.eyebrow === 'OYUN ZAMANI'
              ? ['oyuncak', 'oyun']
              : item.eyebrow === 'İLHAM AL'
                ? ['hobi', 'sanat', 'boya']
                : ['okul', 'kalem'];
          const category = categories.find((category) =>
            keywords.some((keyword) => category.slug.includes(keyword)),
          );
          if (!category) return null;
          return (
            <Link
              href={`/urunler?category=${encodeURIComponent(category.slug)}`}
              key={item.eyebrow}
              className={`campaign-card ${item.tone}`}
            >
              <div>
                <span className="campaign-eyebrow">{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="campaign-cta">
                  Keşfet <ArrowRight size={16} />
                </span>
              </div>
              <Image src={item.image} width={210} height={210} alt="" />
            </Link>
          );
        })}
      </section>

      <section className="container-wide products-section" id="urunler">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">SENİN İÇİN SEÇTİK</span>
            <h2>
              Çok sevilen ürünler<span className="orange-dot">.</span>
            </h2>
            <p>Okul, ofis ve yaratıcılık için seçtiklerimiz.</p>
          </div>
          <Link href="/urunler" className="text-link">
            Tüm ürünler <ArrowRight size={17} />
          </Link>
        </div>
        <div className="filter-pills" role="group" aria-label="Ürün kategorisine göre filtrele">
          <button
            type="button"
            className={activeCategory === 'all' ? 'active' : ''}
            onClick={() => setActiveCategory('all')}
          >
            Tümü
          </button>
          {topCategories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={activeCategory === category.slug ? 'active' : ''}
              onClick={() => setActiveCategory(category.slug)}
            >
              {category.name}
            </button>
          ))}
        </div>
        {featuredProducts.length ? (
          <div className="products-grid">
            {featuredProducts.map((product) => (
              <LiveProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="store-empty-note">Bu kategoride henüz yayınlanmış ürün bulunmuyor.</p>
        )}
        <div className="centered-cta">
          <Link className="button button-outline" href="/urunler">
            Tüm ürünleri gör <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="container-wide editorial-banner">
        <div className="editorial-image">
          <Image
            src="/illustrations/blocks.svg"
            width={310}
            height={310}
            alt="Renkli oyuncak blokları"
          />
        </div>
        <div className="editorial-content">
          <span className="section-eyebrow">OYUNUN RENGİ DEĞİŞSİN</span>
          <h2>
            Hayal kurmak
            <br />
            hiç bu kadar <i>eğlenceli</i> olmamıştı.
          </h2>
          <p>
            Oyuncaklardan yaratıcı hobi setlerine, meraklı küçük zihinler için renkli seçenekler.
          </p>
          <Link href="/urunler" className="button button-dark">
            Ürünlere göz at <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>

      {distinctNewProducts.length > 0 && (
        <section className="container-wide products-section second-product-section">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">YENİ FİKİRLERE YER AÇ</span>
              <h2>
                Yeni gelenler<span className="orange-dot">.</span>
              </h2>
              <p>Mağazamıza yeni gelen ürünleri keşfet.</p>
            </div>
            <Link href="/urunler" className="text-link">
              Hepsini keşfet <ArrowRight size={17} />
            </Link>
          </div>
          <div className="products-grid">
            {distinctNewProducts.map((product) => (
              <LiveProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="container-wide local-section">
        <div className="local-icon">
          <MapPin size={30} />
        </div>
        <div>
          <span className="section-eyebrow">MAHALLEDEN DÜNYAYA</span>
          <h2>Bir de mağazamıza bekleriz!</h2>
          <p>
            İstanbul Bağcılar Güneşli’deki Öz Kırtasiye’yi ziyaret et; ürünleri yakından keşfet.
          </p>
        </div>
        <Link href="/iletisim" className="button button-outline">
          İletişim ve konum <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
