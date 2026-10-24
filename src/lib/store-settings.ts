import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from '@/lib/store-profile';

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!hasSupabaseConfig()) return DEFAULT_STORE_SETTINGS;
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('store_settings')
      .select(
        'id,brand_name,legal_name,tax_office,tax_number,mersis_number,registered_address,support_phone,support_email,whatsapp_phone,business_hours,return_address,shipping_information,return_instructions,shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold,pickup_instructions',
      )
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return DEFAULT_STORE_SETTINGS;
    return { ...DEFAULT_STORE_SETTINGS, ...data } as StoreSettings;
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}
