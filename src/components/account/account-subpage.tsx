import Link from 'next/link';
import { ArrowLeft, BadgePercent, Bell, MapPin, Package, RotateCcw, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
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

/** Shared, accessible page shell for all account subpages. The store layout
 * already owns <main>, so nested routes must use a <section>. */
export function AccountSubpage({ active, title, description, icon, children }: Props) {
  return (
    <section className={`container-wide ${styles.page}`} aria-label={title}>
      <Link href="/hesabim" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" /> Hesabıma dön
      </Link>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className="section-eyebrow">ÖZ KIRTASİYE / HESABIM</span>
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
    </section>
  );
}
