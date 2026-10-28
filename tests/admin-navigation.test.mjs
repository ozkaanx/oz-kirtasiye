import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADMIN_MENU_GROUPS,
  ADMIN_MENU_FOOTER,
  getActiveAdminGroup,
  isAdminRouteActive,
} from '../src/lib/admin-navigation.ts';

test('navigation has clear, complete, non-repeating categories', () => {
  assert.deepEqual(
    ADMIN_MENU_GROUPS.map((group) => group.label),
    ['Genel', 'Katalog', 'Satış ve operasyon', 'Pazarlama'],
  );
  const menuHrefs = ADMIN_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.href));
  assert.equal(menuHrefs.length, 14);
  assert.equal(new Set(menuHrefs).size, menuHrefs.length);
  assert.ok(menuHrefs.every((href) => href.startsWith('/admin/')));
  assert.ok(ADMIN_MENU_GROUPS.every((group) => group.items.length > 0));
  assert.deepEqual(
    ADMIN_MENU_FOOTER.map((item) => item.href),
    ['/admin/ayarlar', '/'],
  );
  assert.ok(ADMIN_MENU_FOOTER.every((item) => !menuHrefs.includes(item.href)));
});

test('each admin route opens the group that contains its menu link', () => {
  for (const group of ADMIN_MENU_GROUPS) {
    for (const item of group.items) {
      assert.equal(getActiveAdminGroup(item.href), group.id, item.href);
      assert.equal(isAdminRouteActive(item.href, item.href), true);
    }
  }
  assert.equal(getActiveAdminGroup('/admin/urunler/product-123/varyantlar'), 'catalog');
  assert.equal(getActiveAdminGroup('/admin/musteriler/customer-123'), 'sales');
  assert.equal(getActiveAdminGroup('/admin/ayarlar'), null);
  assert.equal(getActiveAdminGroup('/admin/nonexistent'), null);
});

test('route matches cannot highlight a partial prefix, storefront or sibling page', () => {
  assert.equal(isAdminRouteActive('/admin/urunler/abc', '/admin/urunler'), true);
  assert.equal(isAdminRouteActive('/admin/urunlerimiz', '/admin/urunler'), false);
  assert.equal(isAdminRouteActive('/admin/kupon-atamalari', '/admin/kuponlar'), false);
  assert.equal(isAdminRouteActive('/admin/urunler', '/'), false);
  assert.equal(isAdminRouteActive('/', '/'), true);
  assert.equal(isAdminRouteActive('/admin/genel-bakis', '/admin/raporlar'), false);
});
