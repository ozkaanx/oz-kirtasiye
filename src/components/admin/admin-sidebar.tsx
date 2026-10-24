'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BadgePercent,
  Megaphone,
  ReceiptText,
  Boxes,
  ClipboardList,
  FolderTree,
  Menu,
  Package,
  Settings2,
  Truck,
  X,
} from 'lucide-react';
import styles from './admin-sidebar.module.css';

const navigation = [
  { href: '/admin/genel-bakis', label: 'Genel bakış', icon: BarChart3 },
  { href: '/admin/urunler', label: 'Ürün ve stok', icon: Boxes },
  { href: '/admin/kategoriler', label: 'Kategoriler', icon: FolderTree },
  { href: '/admin/kuponlar', label: 'Kuponlar', icon: BadgePercent },
  { href: '/admin/kampanyalar', label: 'Otomatik kampanyalar', icon: Megaphone },
  { href: '/admin/siparisler', label: 'Sipariş yönetimi', icon: ClipboardList },
  { href: '/admin/faturalar', label: 'Faturalar', icon: ReceiptText },
  { href: '/admin/kargo-ayarlari', label: 'Kargo ve teslimat', icon: Truck },
  { href: '/admin/ayarlar', label: 'İşletme ayarları', icon: Settings2 },
  { href: '/', label: 'Mağazayı görüntüle', icon: Package },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="admin-mobile-menu-toggle"
        aria-controls="admin-side-navigation"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={19} aria-hidden="true" />
        <span>Menü</span>
      </button>
      {open && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Yönetim menüsünü kapat"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="admin-side-navigation" className={`admin-sidebar${open ? 'is-open' : ''}`}>
        <div className="admin-mobile-sidebar-head">
          <strong>Yönetim menüsü</strong>
          <button type="button" aria-label="Menüyü kapat" onClick={() => setOpen(false)}>
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        <Link href="/" className="admin-brand" onClick={() => setOpen(false)}>
          öz kırtasiye<span>.</span>
        </Link>
        <nav aria-label="Yönetim menüsü" className="admin-sidegroup">
          <div className="admin-side-heading">YÖNETİM</div>
          {navigation.map(({ href, label, icon: Icon }) => {
            const current = href !== '/' && (pathname === href || pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={current ? 'page' : undefined}
                className={styles.navLink}
              >
                <Icon className={styles.navIcon} size={19} aria-hidden="true" />
                <span className={styles.navLabel}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-side-footer">Öz Kırtasiye · Yönetim paneli</div>
      </aside>
    </>
  );
}
