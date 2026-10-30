/** Update this identifier when published disclosure copy materially changes. */
export const LEGAL_DOCUMENT_VERSION = '2026-10-24-v2';

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
  shipping_enabled: boolean;
  pickup_enabled: boolean;
  shipping_flat_fee: number | null;
  free_shipping_threshold: number | null;
  pickup_instructions: string | null;
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
  shipping_enabled: false,
  pickup_enabled: false,
  shipping_flat_fee: null,
  free_shipping_threshold: null,
  pickup_instructions: null,
};

export function storeDetailsMissing(settings: StoreSettings): string[] {
  const missing: string[] = [];
  if (!settings.support_phone?.trim()) missing.push('Destek telefonu');
  if (!settings.support_email?.trim()) missing.push('Destek e-postası');
  if (!settings.tax_office?.trim()) missing.push('Vergi dairesi');
  if (!settings.return_address?.trim()) missing.push('İade adresi');
  if (!settings.shipping_information?.trim()) missing.push('Kargo/teslimat koşulları');
  if (!settings.return_instructions?.trim()) missing.push('İade işlem talimatları');
  return missing;
}

export function supportPhoneHref(value: string): string {
  return `tel:${value.replace(/[^+\d]/g, '')}`;
}
