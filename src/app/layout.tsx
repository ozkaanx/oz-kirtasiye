import type { Metadata } from 'next';
import { ShopProvider } from '@/context/shop-context';
import { getSiteUrl, isSeoPublic, STORE_DESCRIPTION, STORE_NAME } from '@/lib/seo';
import './globals.css';

const site = getSiteUrl();
const isPublic = isSeoPublic();

export const metadata: Metadata = {
  ...(site ? { metadataBase: site } : {}),
  title: { default: `${STORE_NAME} | Renkli fikirler, mutlu başlangıçlar`, template: `%s | ${STORE_NAME}` },
  description: STORE_DESCRIPTION,
  applicationName: STORE_NAME,
  openGraph: {
    type: 'website', locale: 'tr_TR', siteName: STORE_NAME,
    title: `${STORE_NAME} | Renkli fikirler, mutlu başlangıçlar`,
    description: STORE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: isPublic, follow: isPublic, googleBot: { index: isPublic, follow: isPublic } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body><ShopProvider>{children}</ShopProvider></body>
    </html>
  );
}
