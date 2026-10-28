/**
 * One source of truth for administrator navigation. Kept independent from
 * React/Next.js so menu visibility and nested-route matching can be tested.
 */
export const ADMIN_MENU_GROUPS = [
  {
    id: 'general',
    label: 'Genel',
    icon: 'chart',
    items: [
      { href: '/admin/genel-bakis', label: 'Genel bakış', icon: 'chart' },
      { href: '/admin/raporlar', label: 'Raporlar', icon: 'reports' },
      { href: '/admin/bildirimler', label: 'Bildirimler', icon: 'bell' },
    ],
  },
  {
    id: 'catalog',
    label: 'Katalog',
    icon: 'boxes',
    items: [
      { href: '/admin/urunler', label: 'Ürün ve stok', icon: 'boxes' },
      { href: '/admin/kategoriler', label: 'Kategoriler', icon: 'categories' },
      { href: '/admin/yorumlar', label: 'Ürün yorumları', icon: 'reviews' },
    ],
  },
  {
    id: 'sales',
    label: 'Satış ve operasyon',
    icon: 'orders',
    items: [
      { href: '/admin/siparisler', label: 'Sipariş yönetimi', icon: 'orders' },
      { href: '/admin/musteriler', label: 'Müşteriler (CRM)', icon: 'users' },
      { href: '/admin/iadeler', label: 'İade ve değişim', icon: 'returns' },
      { href: '/admin/faturalar', label: 'Faturalar', icon: 'invoice' },
      { href: '/admin/kargo-ayarlari', label: 'Kargo ve teslimat', icon: 'truck' },
    ],
  },
  {
    id: 'marketing',
    label: 'Pazarlama',
    icon: 'marketing',
    items: [
      { href: '/admin/kuponlar', label: 'Kuponlar', icon: 'coupon' },
      { href: '/admin/kupon-atamalari', label: 'Kupon atamaları', icon: 'gift' },
      { href: '/admin/kampanyalar', label: 'Otomatik kampanyalar', icon: 'marketing' },
    ],
  },
] as const;

export type AdminMenuGroupId = (typeof ADMIN_MENU_GROUPS)[number]['id'];

export const ADMIN_MENU_FOOTER = [
  { href: '/admin/ayarlar', label: 'İşletme ayarları', icon: 'settings' },
  { href: '/', label: 'Mağazayı görüntüle', icon: 'store' },
] as const;

/** Matches both list routes and nested detail pages, never similar prefixes. */
export function isAdminRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Open the group containing the current route after direct navigation/refresh. */
export function getActiveAdminGroup(pathname: string): AdminMenuGroupId | null {
  return ADMIN_MENU_GROUPS.find((group) =>
    group.items.some((item) => isAdminRouteActive(pathname, item.href)),
  )?.id ?? null;
}
