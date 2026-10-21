'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
  MapPin,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { StoreCategory } from '@/lib/category-utils';
import { useShop } from '@/context/shop-context';
import { Logo } from './logo';

export function Header({ categories }: { categories: StoreCategory[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { cartCount, favorites, setCartOpen } = useShop();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/urunler?q=${encodeURIComponent(q)}` : '/urunler');
    setMobileMenuOpen(false);
  }

  return (
    <>
      <div className="announcement">
        <div className="container-wide announcement-inner">
          <span>
            <Sparkles size={14} fill="currentColor" /> Her gün biraz daha renkli!
          </span>
          <span className="announcement-location">
            <MapPin size={13} /> İstanbul · Bağcılar / Güneşli
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container-wide header-main">
          <button
            className="icon-button mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
          <Logo />
          <form className="searchbar" onSubmit={handleSearch} role="search">
            <Search size={20} className="searchbar-icon" />
            <input
              aria-label="Ürün ara"
              type="search"
              placeholder="Defter, kalem, oyuncak... Ne aramıştın?"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">
              Ara <ChevronRight size={16} />
            </button>
          </form>
          <div className="header-actions">
            <Link href="/hesabim" className="header-action user-action" aria-label="Hesabım">
              <UserRound size={22} />
              <span>Hesabım</span>
            </Link>
            <Link
              href="/favoriler"
              className="header-action"
              aria-label={`Favorilerim, ${favorites.length} ürün`}
            >
              <span className="action-icon">
                <Heart size={22} />
                {favorites.length > 0 && <span className="action-count">{favorites.length}</span>}
              </span>
              <span>Favorilerim</span>
            </Link>
            <button
              className="header-action"
              aria-label={`Sepetim, ${cartCount} ürün`}
              onClick={() => setCartOpen(true)}
            >
              <span className="action-icon">
                <ShoppingBag size={22} />
                <span className="action-count">{cartCount}</span>
              </span>
              <span>Sepetim</span>
            </button>
          </div>
        </div>
        <div className="mobile-search-wrap container-wide">
          <form className="searchbar mobile-search" onSubmit={handleSearch} role="search">
            <Search size={19} className="searchbar-icon" />
            <input
              aria-label="Mobil ürün ara"
              type="search"
              placeholder="Hadi bir şeyler bulalım..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" aria-label="Ara">
              <ChevronRight size={18} />
            </button>
          </form>
        </div>
        <nav
          className={`category-nav ${mobileMenuOpen ? 'nav-is-open' : ''}`}
          aria-label="Ana menü"
        >
          <div className="container-wide category-nav-inner">
            <Link href="/urunler" className="nav-all" onClick={() => setMobileMenuOpen(false)}>
              <Menu size={18} /> Tüm Ürünler
            </Link>
            {categories
              .filter((category) => !category.parent_id)
              .slice(0, 6)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/urunler?category=${encodeURIComponent(category.slug)}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {category.name}
                </Link>
              ))}
            <Link className="nav-about" href="/hakkimizda" onClick={() => setMobileMenuOpen(false)}>
              Bizi tanıyın <span>↗</span>
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
