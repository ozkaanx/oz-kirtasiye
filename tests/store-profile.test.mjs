import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_STORE_SETTINGS, storeDetailsMissing } from '../src/lib/store-profile.ts';

test('launch checklist requires return instructions even when other contact fields are filled', () => {
  const settings = {
    ...DEFAULT_STORE_SETTINGS,
    support_phone: '02120000000',
    support_email: 'destek@example.com',
    tax_office: 'Güneşli',
    return_address: 'İade adresi',
    shipping_information: '2 iş günü',
  };
  assert.deepEqual(storeDetailsMissing(settings), ['İade işlem talimatları']);
  assert.deepEqual(
    storeDetailsMissing({ ...settings, return_instructions: 'Başvuru talimatları' }),
    [],
  );
  assert.ok(storeDetailsMissing({ ...settings, support_phone: '   ' }).includes('Destek telefonu'));
});
