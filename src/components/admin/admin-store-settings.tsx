'use client';

import { type FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Save, ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { storeDetailsMissing, type StoreSettings } from '@/lib/store-profile';

type EditableKey = Exclude<
  keyof StoreSettings,
  | 'id'
  | 'shipping_enabled'
  | 'pickup_enabled'
  | 'shipping_flat_fee'
  | 'free_shipping_threshold'
  | 'pickup_instructions'
>;
type FormFields = Record<EditableKey, string>;
const fields: EditableKey[] = [
  'brand_name',
  'legal_name',
  'tax_office',
  'tax_number',
  'mersis_number',
  'registered_address',
  'support_phone',
  'support_email',
  'whatsapp_phone',
  'business_hours',
  'return_address',
  'shipping_information',
  'return_instructions',
];

function normalize(settings: StoreSettings): FormFields {
  return Object.fromEntries(fields.map((key) => [key, settings[key] ?? ''])) as FormFields;
}

export function AdminStoreSettings({ initialSettings }: { initialSettings: StoreSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<FormFields>(() => normalize(initialSettings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const current: StoreSettings = {
    id: 1,
    ...Object.fromEntries(fields.map((key) => [key, form[key].trim() || null])),
    brand_name: form.brand_name.trim(),
    legal_name: form.legal_name.trim(),
    registered_address: form.registered_address.trim(),
  } as StoreSettings;
  const missing = storeDetailsMissing(current);

  const update = (name: EditableKey, value: string) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    setSuccess('');
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSuccess('');
    if (
      current.brand_name.length < 2 ||
      current.legal_name.length < 5 ||
      current.registered_address.length < 12
    ) {
      setError('Marka adı, satıcı unvanı ve tam adres zorunludur.');
      return;
    }
    if (current.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.support_email)) {
      setError('Geçerli bir destek e-postası gir.');
      return;
    }
    if (current.support_phone && !/^[+\d\s()-]{10,30}$/.test(current.support_phone)) {
      setError('Geçerli bir telefon numarası gir.');
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(fields.map((key) => [key, current[key]]));
      const { data, error: dbError } = await createBrowserSupabase()
        .from('store_settings')
        .update(payload)
        .eq('id', 1)
        .select('id')
        .single();
      if (dbError) throw dbError;
      if (!data) throw new Error('İşletme bilgileri kaydedilemedi.');
      setSuccess('İşletme bilgileri kaydedildi. Yasal ve iletişim sayfaları güncellendi.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await createBrowserSupabase().auth.signOut();
    router.replace('/admin/giris');
    router.refresh();
  }

  function input(label: string, name: EditableKey, required = false, placeholder?: string) {
    return (
      <label className="admin-field" key={name}>
        {label}
        {required ? ' *' : ''}
        <input
          required={required}
          value={form[name]}
          placeholder={placeholder}
          maxLength={name === 'registered_address' || name === 'return_address' ? 500 : 160}
          onChange={(event) => update(name, event.target.value)}
        />
      </label>
    );
  }
  function textarea(label: string, name: EditableKey, placeholder?: string) {
    return (
      <label className="admin-field admin-form-wide" key={name}>
        {label}
        <textarea
          rows={4}
          maxLength={1500}
          value={form[name]}
          placeholder={placeholder}
          onChange={(event) => update(name, event.target.value)}
        />
      </label>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <div className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button className="admin-logout" onClick={() => void logout()}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
        <div className="admin-body">
          <div className="admin-page-heading">
            <div>
              <span className="section-eyebrow">ÖZ KIRTASİYE · İŞLETME BİLGİLERİ</span>
              <h1>
                Mağaza ayarları<span className="orange-dot">.</span>
              </h1>
              <p>Bu alanlardaki bilgiler yasal ve iletişim sayfalarına yansır.</p>
            </div>
          </div>
          <div className="settings-checklist" role="status">
            <ShieldCheck size={20} />
            <div>
              <strong>Canlı yayına hazırlık</strong>
              <p>
                {missing.length
                  ? `Tamamlanacak alanlar: ${missing.join(', ')}.`
                  : 'İletişim ve operasyon alanları dolduruldu. Yasal metinler ayrıca hukukî onay gerektirir.'}
              </p>
            </div>
          </div>
          {error && (
            <div role="alert" className="admin-form-error">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="admin-form-success">
              {success}
            </div>
          )}
          <form className="settings-form" onSubmit={(event) => void save(event)}>
            <section className="admin-content-box settings-section">
              <div className="settings-section-title">
                <h2>Resmî işletme bilgileri</h2>
                <p>Vergi levhasındaki bilgileri esas al. Resmî unvanı marka adıyla karıştırma.</p>
              </div>
              <div className="settings-grid">
                {input('Mağaza adı', 'brand_name', true)}
                {input('Ticari unvan', 'legal_name', true)}
                {input('Vergi dairesi', 'tax_office')}
                {input('Vergi numarası', 'tax_number')}
                {input('MERSİS numarası', 'mersis_number')}
                {input('İşletme adresi', 'registered_address', true)}
              </div>
            </section>
            <section className="admin-content-box settings-section">
              <div className="settings-section-title">
                <h2>İletişim</h2>
                <p>Gireceğin telefon ve e-posta müşteri sayfalarında yayınlanacak.</p>
              </div>
              <div className="settings-grid">
                {input('Destek telefonu', 'support_phone', false, '0 5XX XXX XX XX')}
                {input('Destek e-postası', 'support_email', false, 'destek@alanadi.com')}
                {input('WhatsApp numarası (isteğe bağlı)', 'whatsapp_phone')}
                {input(
                  'Çalışma saatleri',
                  'business_hours',
                  false,
                  'Pazartesi–Cumartesi 09.00–19.00',
                )}
              </div>
            </section>
            <section className="admin-content-box settings-section">
              <div className="settings-section-title">
                <h2>Kargo ve iade</h2>
                <p>Henüz belirlenmeyen ücret ve teslimat sürelerini tahmini olarak yazma.</p>
              </div>
              <div className="settings-grid">
                {input(
                  'Ürün iade adresi',
                  'return_address',
                  false,
                  'İade kabul edilecek açık adres',
                )}
                {textarea(
                  'Kargo/teslimat açıklaması',
                  'shipping_information',
                  'Anlaşmalı taşıyıcı, ücret hesaplama yöntemi ve teslimat zamanı',
                )}
                {textarea(
                  'İade işlem talimatları',
                  'return_instructions',
                  'İade başvurusu ve gönderim için doğrulanmış uygulama',
                )}
              </div>
            </section>
            <div className="settings-form-actions">
              <button type="submit" disabled={saving} className="button button-primary">
                <Save size={17} />
                {saving ? 'Kaydediliyor...' : 'Ayarları kaydet'}
              </button>
              <Link href="/iletisim" className="button button-outline">
                İletişim sayfasını gör
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
