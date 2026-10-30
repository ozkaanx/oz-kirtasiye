import { hasSupabaseConfig } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from '@/lib/store-profile';
import { operationTrace } from '@/lib/operation-trace';

/** Editors must never save fallback values over the real store configuration. */
export async function getStoreSettings(
  options: { required?: boolean } = {},
): Promise<StoreSettings> {
  const trace = operationTrace('store_settings');
  const unavailable = () => {
    if (options.required) throw new Error('Mağaza bilgileri şu anda yüklenemiyor.');
    return DEFAULT_STORE_SETTINGS;
  };
  if (!hasSupabaseConfig()) {
    trace.error('unavailable');
    return unavailable();
  }
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('store_settings')
      .select(
        'id,brand_name,legal_name,tax_office,tax_number,mersis_number,registered_address,support_phone,support_email,whatsapp_phone,business_hours,return_address,shipping_information,return_instructions,shipping_enabled,pickup_enabled,shipping_flat_fee,free_shipping_threshold,pickup_instructions',
      )
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      trace.error(error ? 'database_error' : 'empty_result', error?.code);
    } else {
      return { ...DEFAULT_STORE_SETTINGS, ...data } as StoreSettings;
    }
  } catch {
    trace.error('unexpected');
  }
  return unavailable();
}
