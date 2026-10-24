/** Update this identifier when published disclosure copy materially changes. */
export const LEGAL_DOCUMENT_VERSION = '2026-10-24-v1';

export type StoreSettings = {
  id: number;
  brand_name: string;
  legal_name: string;
  tax_office: string | null;
  tax_number: string | null;
  mersis_number: string | null;
  registered_address: string;
  support_phone: string | null;
  support_email: string | null;
  whatsapp_phone: string | null;
  business_hours: string | null;
  return_address: string | null;
  shipping_information: string | null;
  return_instructions: string | null;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: 1,
  brand_name: 'Öz Kırtasiye',
  legal_name: 'ESEN KIRTASİYE SAMİ TATAR',
  tax_office: null,
  tax_number: '36398117570',
  mersis_number: '3639811757000011',
  registered_address: 'Güneşli Mahallesi, Fevzi Çakmak Caddesi No:52/B, Bağcılar / İstanbul',
  support_phone: null,
  support_email: null,
  whatsapp_phone: null,
  business_hours: null,
  return_address: null,
  shipping_information: null,
  return_instructions: null,
};

export function storeDetailsMissing(settings: StoreSettings): string[] {
  const missing: string[] = [];
  if (!settings.support_phone) missing.push('Destek telefonu');
  if (!settings.support_email) missing.push('Destek e-postası');
  if (!settings.tax_office) missing.push('Vergi dairesi');
  if (!settings.return_address) missing.push('İade adresi');
  if (!settings.shipping_information) missing.push('Kargo/teslimat koşulları');
  return missing;
}

export function supportPhoneHref(value: string): string {
  return `tel:${value.replace(/[^+\d]/g, '')}`;
}
