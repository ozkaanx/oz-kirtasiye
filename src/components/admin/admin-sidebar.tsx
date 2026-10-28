'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BadgePercent,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  FolderTree,
  Gift,
  LayoutDashboard,
  Megaphone,
  Menu,
  Package,
  ReceiptText,
  RotateCcw,
  Settings2,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { NotificationUnreadBadge } from '@/components/notifications/unread-badge';
import {
  ADMIN_MENU_FOOTER,
  ADMIN_MENU_GROUPS,
  getActiveAdminGroup,
  isAdminRouteActive,
  type AdminMenuGroupId,
} from '@/lib/admin-navigation';
import styles from './admin-sidebar.module.css';

const iconByKey = {
  chart: LayoutDashboard,
  reports: BarChart3,
  bell: Bell,
  boxes: Boxes,
  categories: FolderTree,
  orders: ClipboardList,
  users: Users,
  returns: RotateCcw,
  invoice: ReceiptText,
  truck: Truck,
  marketing: Megaphone,
  coupon: BadgePercent,
  gift: Gift,
  settings: Settings2,
  store: Store,
} as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const activeGroup = getActiveAdminGroup(pathname);
  const [expandedGroup, setExpandedGroup] = useState<AdminMenuGroupId | null>(activeGroup);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // A new route (including detail screens) automatically reveals its category.
  useEffect(() => {
    setExpandedGroup(getActiveAdminGroup(pathname));
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
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

      <aside id="admin-side-navigation" className={`admin-sidebar ${styles.sidebar} ${open ? 'is-open' : ''}`}>
        <div className="admin-mobile-sidebar-head">
          <strong>Yönetim menüsü</strong>
          <button type="button" aria-label="Menüyü kapat" onClick={() => setOpen(false)}>
            <X size={21} aria-hidden="true" />
          </button>
        </div>

        <Link href="/" className={`admin-brand ${styles.brand}`} onClick={() => setOpen(false)}>
          öz kırtasiye<span>.</span>
        </Link>
        <p className={styles.caption}>YÖNETİM PANELİ</p>

        <nav aria-label="Yönetim menüsü" className={styles.groups}>
          {ADMIN_MENU_GROUPS.map((group) => {
            const expanded = expandedGroup === group.id;
            const highlighted = activeGroup === group.id;
            const GroupIcon = iconByKey[group.icon];
            const panelId = `admin-nav-${group.id}`;
            return (
              <section key={group.id} className={styles.group}>
                <h2 className={styles.groupHeading}>
                  <button
                    type="button"
                    className={styles.groupButton}
                    data-selected={highlighted}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setExpandedGroup((current) => current === group.id ? null : group.id)}
                  >
                    <GroupIcon size={18} aria-hidden="true" className={styles.groupIcon} />
                    <span>{group.label}</span>
                    {group.id === 'general' && !expanded && (
                      <NotificationUnreadBadge audience="admin" />
                    )}
                    <ChevronDown size={17} className={styles.chevron} aria-hidden="true" />
                  </button>
                </h2>

                <div id={panelId} className={styles.groupItems} hidden={!expanded}>
                  {group.items.map((item) => {
                    const Icon = iconByKey[item.icon];
                    const current = isAdminRouteActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={current ? 'page' : undefined}
                        className={styles.navLink}
                      >
                        <Icon className={styles.navIcon} size={18} aria-hidden="true" />
                        <span className={styles.navLabel}>
                          {item.label}
                          {expanded && item.href === '/admin/bildirimler' && <NotificationUnreadBadge audience="admin" />}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className={styles.bottom}>
          <nav aria-label="Ayarlar ve mağaza bağlantıları" className={styles.footerNav}>
            {ADMIN_MENU_FOOTER.map((item) => {
              const Icon = iconByKey[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isAdminRouteActive(pathname, item.href) && item.href !== '/' ? 'page' : undefined}
                  className={`${styles.navLink} ${item.href === '/' ? styles.storeLink : styles.footerLink}`}
                >
                  <Icon className={styles.navIcon} size={18} aria-hidden="true" />
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={styles.copyright}>Öz Kırtasiye · Yönetim paneli</div>
        </div>
      </aside>
    </>
  );
}
