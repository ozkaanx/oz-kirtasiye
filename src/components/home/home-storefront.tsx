"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Headphones, MapPin, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { categories, products } from "@/data/catalog";
import { ProductCard } from "@/components/product/product-card";
import type { CategoryId } from "@/types/shop";

const campaignCards = [
  { eyebrow: "YENİ SEZON", title: "Okula dönüş\nfırsatları", description: "Yeni döneme rengârenk başla.", href: "/urunler?category=canta", image: "/illustrations/bag.svg", tone: "campaign-sky" },
  { eyebrow: "OYUN ZAMANI", title: "Oyuncakta\neğlenceli seçimler", description: "Minik hayallere büyük oyunlar.", href: "/urunler?category=oyuncak", image: "/illustrations/blocks.svg", tone: "campaign-peach" },
  { eyebrow: "İLHAM AL", title: "Renklerini\nözgür bırak", description: "Sanat ve hobi ürünlerini keşfet.", href: "/urunler?category=boya", image: "/illustrations/paints.svg", tone: "campaign-mint" },
];

export function HomeStorefront() {
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">("all");
  const visibleProducts = useMemo(() => activeCategory === "all" ? products.slice(0, 8) : products.filter(p => p.category === activeCategory), [activeCategory]);

  return <>
    <section className="container-wide hero-section" aria-label="Yeni sezon kırtasiye ürünleri">
      <div className="hero-content">
        <span className="hero-eyebrow"><span className="tiny-dot"/> YENİ SEZON · YENİ HEYECAN</span>
        <h1>Renkli fikirler,<br/>mutlu başlangıçlar<span className="orange-dot">.</span></h1>
        <p>Kırtasiye, oyuncak ve okul ihtiyaçlarında aradığın her şey Öz Kırtasiye’de. Yeni fikirlere yer aç!</p>
        <div className="hero-buttons"><Link href="#urunler" className="button button-primary">Ürünleri keşfet <ArrowRight size={18}/></Link><Link href="#kategoriler" className="button button-outline">Kategoriler <ArrowUpRight size={18}/></Link></div>
        <div className="hero-subnote"><Sparkles size={16}/> Her günün biraz daha renkli olsun.</div>
      </div>
      <div className="hero-visual"><div className="hero-glow"/><Image src="/illustrations/hero-scene.svg" width={670} height={550} priority alt="Defter, renkli kalemler ve kırtasiye malzemeleri illüstrasyonu"/><span className="hero-note">Yeni fikirler burada! <span>✳</span></span></div>
    </section>

    <section className="container-wide trust-strip" aria-label="Mağaza avantajları">
      <div><PackageCheck size={24}/><span><strong>Rengârenk seçenekler</strong><small>Okuldan oyuna her şey</small></span></div>
      <div><ShieldCheck size={24}/><span><strong>Özenli alışveriş</strong><small>Kolayca keşfet, seç ve ekle</small></span></div>
      <div><Headphones size={24}/><span><strong>Biz buradayız</strong><small>Soruların için bize ulaş</small></span></div>
      <div><MapPin size={24}/><span><strong>Mahallenin kırtasiyesi</strong><small>Bağcılar · Güneşli</small></span></div>
    </section>

    <section className="container-wide categories-section" id="kategoriler">
      <div className="section-heading"><div><span className="section-eyebrow">BİRLİKTE KEŞFEDELİM</span><h2>Kategorileri keşfet<span className="orange-dot">.</span></h2><p>Aradığını bulmanın en renkli yolu.</p></div><Link href="/urunler" className="text-link">Tüm kategoriler <ArrowRight size={17}/></Link></div>
      <div className="category-grid">{categories.map(c => <Link className="category-card" key={c.id} href={`/urunler?category=${c.id}`}><div className="category-picture" style={{backgroundColor:c.color}}><Image src={c.picture} width={180} height={160} alt=""/></div><h3>{c.label}</h3><span className="category-link">Keşfet <ArrowUpRight size={14}/></span></Link>)}</div>
    </section>

    <section className="container-wide campaigns-grid" aria-label="Öne çıkan kategoriler">{campaignCards.map(c => <Link href={c.href} key={c.eyebrow} className={`campaign-card ${c.tone}`}><div><span className="campaign-eyebrow">{c.eyebrow}</span><h3>{c.title}</h3><p>{c.description}</p><span className="campaign-cta">Keşfet <ArrowRight size={16}/></span></div><Image src={c.image} width={210} height={210} alt=""/></Link>)}</section>

    <section className="container-wide products-section" id="urunler">
      <div className="section-heading"><div><span className="section-eyebrow">SENİN İÇİN SEÇTİK</span><h2>Çok sevilen ürünler<span className="orange-dot">.</span></h2><p>Renkli dünyamızdan öne çıkanlar. <span className="demo-note">Ürün ve fiyatlar örnektir.</span></p></div><Link href="/urunler" className="text-link">Tüm ürünler <ArrowRight size={17}/></Link></div>
      <div className="filter-pills" role="group" aria-label="Ürün kategorisine göre filtrele"><button type="button" className={activeCategory === "all" ? "active" : ""} onClick={()=>setActiveCategory("all")}>Tümü</button>{categories.map(c=><button type="button" key={c.id} className={activeCategory===c.id ? "active" : ""} onClick={()=>setActiveCategory(c.id)}>{c.label}</button>)}</div>
      <div className="products-grid">{visibleProducts.map(p=><ProductCard key={p.id} product={p}/>)}</div>
      <div className="centered-cta"><Link className="button button-outline" href="/urunler">Tüm ürünleri gör <ArrowRight size={18}/></Link></div>
    </section>

    <section className="container-wide editorial-banner"><div className="editorial-image"><Image src="/illustrations/blocks.svg" width={310} height={310} alt="Renkli oyuncak blokları"/></div><div className="editorial-content"><span className="section-eyebrow">OYUNUN RENGİ DEĞİŞSİN</span><h2>Hayal kurmak<br/>hiç bu kadar <i>eğlenceli</i> olmamıştı.</h2><p>Oyuncaklardan yaratıcı hobi setlerine, meraklı küçük zihinler için renkli seçenekler.</p><Link href="/urunler?category=oyuncak" className="button button-dark">Oyuncaklara göz at <ArrowUpRight size={18}/></Link></div></section>

    <section className="container-wide products-section second-product-section"><div className="section-heading"><div><span className="section-eyebrow">YENİ FİKİRLERE YER AÇ</span><h2>Keşfedilecek daha çok şey var<span className="orange-dot">.</span></h2><p>Okul ve ofis için renkli seçenekler.</p></div><Link href="/urunler" className="text-link">Hepsini keşfet <ArrowRight size={17}/></Link></div><div className="products-grid">{products.slice(4, 8).map(p=><ProductCard key={p.id} product={p}/>)}</div></section>

    <section className="container-wide local-section"><div className="local-icon"><MapPin size={30}/></div><div><span className="section-eyebrow">MAHALLEDEN DÜNYAYA</span><h2>Bir de mağazamıza bekleriz!</h2><p>İstanbul Bağcılar Güneşli’deki Öz Kırtasiye’yi ziyaret et; ürünleri yakından keşfet.</p></div><Link href="/iletisim" className="button button-outline">İletişim ve konum <ArrowRight size={17}/></Link></section>
  </>;
}
