import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mobileRootCategories, mobileChildCategories } from '../src/lib/mobile-navigation.ts';

const category = (id, parent_id = null, sort_order = 0, is_active = true, name = id) => ({
  id, parent_id, sort_order, is_active, name,
  slug: id, description: null, image_path: null,
});

test('mobile drawer lists active root categories in configured order', () => {
  const input = [
    category('second', null, 2),
    category('hidden', null, 0, false),
    category('child', 'first', 0),
    category('first', null, 1),
    category('orphan', 'inactive-parent', 3),
    category('inactive-parent', null, 0, false),
  ];
  assert.deepEqual(mobileRootCategories(input).map((item) => item.id), [
    'first', 'second', 'orphan',
  ]);
});

test('expandable categories include only active direct children', () => {
  const input = [
    category('root'), category('z', 'root', 2),
    category('a', 'root', 1), category('inactive', 'root', 0, false),
    category('grandchild', 'a', 0), category('self', 'self'),
  ];
  assert.deepEqual(mobileChildCategories(input, 'root').map((item) => item.id), ['a', 'z']);
  assert.deepEqual(mobileChildCategories(input, 'a').map((item) => item.id), ['grandchild']);
  assert.deepEqual(mobileChildCategories(input, 'self'), []);
});

test('Turkish category titles use stable alphabetical fallback', () => {
  const input = [
    category('z', null, 1, true, 'Zarf'),
    category('a', null, 1, true, 'Çanta'),
  ];
  assert.deepEqual(mobileRootCategories(input).map((item) => item.id), ['a', 'z']);
});
