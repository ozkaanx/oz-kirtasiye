import Link from 'next/link';
import { ArrowLeft, BadgePercent, Bell, MapPin, Package, RotateCcw, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { AccountSidebar } from './account-sidebar';
import accountStyles from './customer-account.module.css';
import styles from './account-subpage.module.css';

type Section = 'benefits' | 'returns' | 'notifications';
type Props = {
  active: Section;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
};

const links = [
  { href: '/hesabim', label: 'Profilim', icon: UserRound },
  { href: '/hesabim?tab=addresses', label: 'Adreslerim', icon: MapPin },
  { href: '/hesabim?tab=orders', label: 'Siparişlerim', icon: Package },
  { href: '/hesabim/avantajlar', label: 'Avantajlarım', icon: BadgePercent, key: 'benefits' },
  { href: '/hesabim/iade', label: 'İade ve değişim', icon: RotateCcw, key: 'returns' },
  { href: '/hesabim/bildirimler', label: 'Bildirimlerim', icon: Bell, key: 'notifications' },
] as const;

/**
 * Desktop: same fixed-left sidebar and right content panel as /hesabim.
 * Mobile: retain the existing standalone subpage (back link + horizontal nav).
 * Routes stay server-rendered and protected: no client-side data duplication.
 */
export function AccountSubpage({ active, title, description, icon, children }: Props) {
  return (
    <section className={`container-wide ${accountStyles.page} ${styles.page}`} aria-label={title}>
      <header className={styles.desktopHeader}>
        <span className="section-eyebrow">ÖZ KIRTASİYE / HESABIM</span>
        <h1>Hesabım<span className="orange-dot">.</span></h1>
        <p>Hesap bilgilerin, adreslerin ve sipariş taleplerin tek bir yerde.</p>
      </header>
      <div className={accountStyles.shell}>
        <div className={styles.desktopSidebar}>
          <AccountSidebar active={active} />
        </div>
        <div className={`${accountStyles.panel} ${styles.panel}`} id="account-content-panel" role="region" aria-label={title}>
          <Link href="/hesabim" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" /> Hesabıma dön
          </Link>
          <header className={styles.header}>
            <div className={styles.heading}>
              <span className={`section-eyebrow ${styles.mobileEyebrow}`}>ÖZ KIRTASİYE / HESABIM</span>
              <h1>{title}<span className="orange-dot">.</span></h1>
              <p>{description}</p>
            </div>
            <span className={styles.headerIcon} aria-hidden="true">{icon}</span>
          </header>
          <nav className={styles.nav} aria-label="Hesap bölümleri">
            {links.map(({ href, label, icon: Icon, ...rest }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.navLink} ${'key' in rest && rest.key === active ? styles.navActive : ''}`}
                aria-current={'key' in rest && rest.key === active ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className={styles.content}>{children}</div>
        </div>
      </div>
    </section>
  );
}
