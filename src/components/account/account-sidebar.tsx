'use client';

import Link from 'next/link';
import { ArrowRight, BadgePercent, Bell, MapPin, Package, RotateCcw, UserRound } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { NotificationUnreadBadge } from '@/components/notifications/unread-badge';
import type { AccountTab } from '@/lib/account-ui';
import styles from './customer-account.module.css';

export type AccountSection = AccountTab | 'benefits' | 'returns' | 'notifications';

type Props = {
  active: AccountSection;
  onAccountTabChange?: (tab: AccountTab) => void;
  disabled?: boolean;
};

/**
 * A single navigation component is shared by the dashboard and its subroutes.
 * The main dashboard switches its local tabs; subroutes use real Next.js links,
 * so existing URLs, server-side auth, and mobile navigation keep working.
 */
export function AccountSidebar({ active, onAccountTabChange, disabled = false }: Props) {
  const { couponCode } = useShop();
  const tabs = [
    { id: 'overview', label: 'Profilim', icon: UserRound, href: '/hesabim' },
    { id: 'addresses', label: 'Adreslerim', icon: MapPin, href: '/hesabim?tab=addresses' },
    { id: 'orders', label: 'Siparişlerim', icon: Package, href: '/hesabim?tab=orders' },
  ] as const;

  return (
    <nav className={styles.tabs} aria-label="Hesap menüsü">
      {tabs.map(({ id, label, icon: Icon, href }) => {
        const className = `${styles.tab} ${active === id ? styles.active : ''}`;
        const contents = <><Icon size={18} aria-hidden="true" /><span>{label}</span></>;
        return onAccountTabChange ? (
          <button
            key={id}
            type="button"
            className={className}
            disabled={disabled}
            aria-pressed={active === id}
            aria-controls="account-content-panel"
            onClick={() => onAccountTabChange(id)}
          >
            {contents}
          </button>
        ) : (
          <Link key={id} href={href} className={className} aria-current={active === id ? 'page' : undefined}>
            {contents}
          </Link>
        );
      })}
      <Link
        href="/hesabim/avantajlar"
        className={`${styles.tab} ${active === 'benefits' ? styles.active : ''}`}
        aria-current={active === 'benefits' ? 'page' : undefined}
      >
        <BadgePercent size={18} aria-hidden="true" />
        <span>Avantajlarım</span>
        {couponCode && <span className={styles.menuHint}>Kod var</span>}
      </Link>
      <Link
        href="/hesabim/iade"
        className={`${styles.tab} ${active === 'returns' ? styles.active : ''}`}
        aria-current={active === 'returns' ? 'page' : undefined}
      >
        <RotateCcw size={18} aria-hidden="true" />
        <span>İade ve değişim</span>
      </Link>
      <Link
        href="/hesabim/bildirimler"
        className={`${styles.tab} ${active === 'notifications' ? styles.active : ''}`}
        aria-current={active === 'notifications' ? 'page' : undefined}
      >
        <Bell size={18} aria-hidden="true" />
        <span>Bildirimler</span>
        <NotificationUnreadBadge audience="customer" />
      </Link>
      <Link href="/urunler" className={styles.shopLink}>
        Alışverişe dön <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </nav>
  );
}
