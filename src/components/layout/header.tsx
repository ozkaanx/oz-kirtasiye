'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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
import { SearchSuggestions, saveRecentSearch } from '@/components/search/search-suggestions';

export function Header({ categories }: { categories: StoreCategory[] }) {
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState<'desktop' | 'mobile' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { cartCount, favorites } = useShop();

  useEffect(() => {
    if (!searchOpen && !mobileMenuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setSearchOpen(null);
        setMobileMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileMenuOpen) menuButtonRef.current?.focus();
        setSearchOpen(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [searchOpen, mobileMenuOpen]);

  function openSearch(target: 'desktop' | 'mobile') {
    setMobileMenuOpen(false);
    setSearchOpen(target);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = search.trim();
    saveRecentSearch(q);
    setSearchOpen(null);
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
      <header
        ref={headerRef}
        className="site-header"
        onClickCapture={(event) => {
          if ((event.target as Element).closest('a[href]')) {
            setSearchOpen(null);
            setMobileMenuOpen(false);
          }
        }}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
            setSearchOpen(null);
            setMobileMenuOpen(false);
          }
        }}
      >
        <div className="container-wide header-main">
          <button
            className="icon-button mobile-menu-toggle"
            ref={menuButtonRef}
            aria-expanded={mobileMenuOpen}
            aria-controls="store-category-menu"
            aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => {
              setSearchOpen(null);
              setMobileMenuOpen(!mobileMenuOpen);
            }}
          >
            {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
          <Logo />
          <form
            className="searchbar"
            style={{ position: 'relative' }}
            onSubmit={handleSearch}
            role="search"
          >
            <Search size={20} className="searchbar-icon" />
            <input
              aria-label="Ürün ara"
              type="search"
              placeholder="Defter, kalem, oyuncak... Ne aramıştın?"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => openSearch('desktop')}
            />
            <button type="submit">
              Ara <ChevronRight size={16} />
            </button>
            {searchOpen === 'desktop' && (
              <SearchSuggestions query={search} onChoose={() => setSearchOpen(null)} />
            )}
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
            <Link href="/sepet" className="header-action" aria-label={`Sepetim, ${cartCount} ürün`}>
              <span className="action-icon">
                <ShoppingBag size={22} />
                <span className="action-count">{cartCount}</span>
              </span>
              <span>Sepetim</span>
            </Link>
          </div>
        </div>
        <div className="mobile-search-wrap container-wide">
          <form
            className="searchbar mobile-search"
            style={{ position: 'relative' }}
            onSubmit={handleSearch}
            role="search"
          >
            <Search size={19} className="searchbar-icon" />
            <input
              aria-label="Mobil ürün ara"
              type="search"
              placeholder="Hadi bir şeyler bulalım..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => openSearch('mobile')}
            />
            <button type="submit" aria-label="Ara">
              <ChevronRight size={18} />
            </button>
            {searchOpen === 'mobile' && (
              <SearchSuggestions query={search} onChoose={() => setSearchOpen(null)} />
            )}
          </form>
        </div>
        <nav
          id="store-category-menu"
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
            <Link
              className="nav-mobile-shortcut"
              href="/hesabim"
              onClick={() => setMobileMenuOpen(false)}
            >
              <UserRound size={18} /> Hesabım
            </Link>
            <Link
              className="nav-mobile-shortcut"
              href="/favoriler"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Heart size={18} /> Favorilerim ({favorites.length})
            </Link>
            <Link
              className="nav-mobile-shortcut"
              href="/iletisim"
              onClick={() => setMobileMenuOpen(false)}
            >
              <MapPin size={18} /> İletişim ve konum
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
