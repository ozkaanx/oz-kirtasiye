'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ChevronDown, Heart, MapPin, PackageOpen, ShoppingBag, Sparkles,
  UserRound, X,
} from 'lucide-react';
import type { StoreCategory } from '@/lib/category-utils';
import { mobileChildCategories, mobileRootCategories } from '@/lib/mobile-navigation';
import styles from './mobile-category-drawer.module.css';

type DrawerProps = {
  categories: StoreCategory[];
  open: boolean;
  cartCount: number;
  favoritesCount: number;
  onClose: () => void;
  onNavigate: () => void;
};

function CategoryNode({
  category,
  categories,
  depth,
  onNavigate,
}: {
  category: StoreCategory;
  categories: StoreCategory[];
  depth: number;
  onNavigate: () => void;
}) {
  const children = depth < 3 ? mobileChildCategories(categories, category.id) : [];
  const categoryUrl = `/urunler?category=${encodeURIComponent(category.slug)}`;
  if (!children.length) {
    return (
      <Link href={categoryUrl} onClick={onNavigate} className={styles.categoryLink}>
        <span>{category.name}</span>
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <details className={styles.categoryDetails}>
      <summary className={styles.categoryToggle}>
        <span>{category.name}</span>
        <ChevronDown size={19} className={styles.categoryChevron} aria-hidden="true" />
      </summary>
      <div className={styles.subcategories}>
        <Link href={categoryUrl} onClick={onNavigate} className={styles.allSubcategory}>
          Tüm {category.name} ürünleri <ArrowRight size={16} aria-hidden="true" />
        </Link>
        {children.map((child) => (
          <CategoryNode
            key={child.id}
            category={child}
            categories={categories}
            depth={depth + 1}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </details>
  );
}

/**
 * The drawer is a fixed, left-hand modal on phones/tablets only.
 * Native details handle nested categories without hard-coded seasonal labels.
 */
export function MobileCategoryDrawer({
  categories,
  open,
  cartCount,
  favoritesCount,
  onClose,
  onNavigate,
}: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function handleKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), summary, input:not(:disabled), [tabindex="0"]',
      );
      // Links inside closed <details> are not focusable despite matching the selector.
      const elements = [...(nodes ?? [])].filter((node) => node.getClientRects().length > 0);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeys);
    };
  }, [open, onClose]);

  const roots = mobileRootCategories(categories);

  return (
    <>
      {open && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Kategori menüsünü kapat"
          onClick={onClose}
          data-store-mobile-drawer
        />
      )}
      <aside
        id="store-category-menu"
        ref={drawerRef}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label="Mağaza kategorileri"
        className={styles.drawer}
        hidden={!open}
        data-store-mobile-drawer
      >
        <header className={styles.drawerHeader}>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Menüyü kapat"
            className={styles.iconButton}
          >
            <X size={22} aria-hidden="true" />
          </button>
          <strong className={styles.drawerLogo}>öz kırtasiye<span>.</span></strong>
          <div className={styles.headerLinks}>
            <Link href="/hesabim" aria-label="Hesabım" onClick={onNavigate}>
              <UserRound size={21} aria-hidden="true" />
            </Link>
            <Link href="/sepet" aria-label={`Sepetim: ${cartCount} ürün`} onClick={onNavigate}>
              <ShoppingBag size={21} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className={styles.scroll}>
          <div className={styles.quickLinks}>
            <Link href="/urunler" onClick={onNavigate} className={styles.quickLink}>
              <PackageOpen size={20} aria-hidden="true" />
              <span>Tüm ürünler</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/urunler?sort=newest" onClick={onNavigate} className={styles.quickLink}>
              <Sparkles size={20} aria-hidden="true" />
              <span>Yeni gelenler</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <nav aria-label="Ürün kategorileri" className={styles.categoryNav}>
            <h2 className={styles.heading}>KATEGORİLER</h2>
            {roots.map((category) => (
              <CategoryNode
                key={category.id}
                category={category}
                categories={categories}
                depth={0}
                onNavigate={onNavigate}
              />
            ))}
          </nav>

          <nav aria-label="Mağaza bağlantıları" className={styles.bottomLinks}>
            <h2 className={styles.heading}>HESABIM VE MAĞAZA</h2>
            <Link href="/hesabim" onClick={onNavigate}>
              <UserRound size={18} aria-hidden="true" /> Hesabım
            </Link>
            <Link href="/favoriler" onClick={onNavigate}>
              <Heart size={18} aria-hidden="true" /> Favorilerim ({favoritesCount})
            </Link>
            <Link href="/hakkimizda" onClick={onNavigate}>
              <ArrowRight size={18} aria-hidden="true" /> Bizi tanıyın
            </Link>
            <Link href="/iletisim" onClick={onNavigate}>
              <MapPin size={18} aria-hidden="true" /> İletişim ve konum
            </Link>
          </nav>
        </div>
      </aside>
    </>
  );
}
