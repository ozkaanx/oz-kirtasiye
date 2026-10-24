'use client';

import { type FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Save, Store, Truck } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { formatPrice } from '@/lib/format';
import { deliveryQuote } from '@/lib/delivery';
import type { StoreSettings } from '@/lib/store-profile';

export function AdminDeliverySettings({ initialSettings }: { initialSettings: StoreSettings }) {
  const router = useRouter();
  const [shippingEnabled, setShippingEnabled] = useState(initialSettings.shipping_enabled);
  const [pickupEnabled, setPickupEnabled] = useState(initialSettings.pickup_enabled);
  const [flatFee, setFlatFee] = useState(initialSettings.shipping_flat_fee?.toString() ?? '');
  const [freeThreshold, setFreeThreshold] = useState(
    initialSettings.free_shipping_threshold?.toString() ?? '',
  );
  const [pickupInstructions, setPickupInstructions] = useState(
    initialSettings.pickup_instructions ?? '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function parseMoney(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const number = Number(trimmed.replace(',', '.'));
    return /^\d+(?:[,.]\d{1,2})?$/.test(trimmed) && Number.isFinite(number) && number >= 0
      ? number
      : Number.NaN;
  }

  const shippingFee = parseMoney(flatFee);
  const threshold = parseMoney(freeThreshold);
  const shippingPreview = deliveryQuote(
    {
      registered_address: initialSettings.registered_address,
      shipping_enabled: shippingEnabled,
      pickup_enabled: pickupEnabled,
      shipping_flat_fee: shippingFee,
      free_shipping_threshold: threshold,
      pickup_instructions: pickupInstructions,
    },
    500,
    'shipping',
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setSuccess('');
    if (
      Number.isNaN(shippingFee) ||
      Number.isNaN(threshold) ||
      (shippingEnabled && shippingFee === null)
    ) {
      setError(
        'Kargo aktifse geçerli bir ücret girilmeli. Tutarlar negatif olamaz ve en fazla iki ondalık basamak içerebilir.',
      );
      return;
    }
    if (
      (shippingFee !== null && shippingFee > 99999.99) ||
      (threshold !== null && threshold > 999999.99)
    ) {
      setError('Girdiğin fiyat veya limit izin verilen aralığı aşıyor.');
      return;
    }
    if (pickupInstructions.length > 1000) {
      setError('Teslim alma talimatı en fazla 1000 karakter olmalı.');
      return;
    }
    setPending(true);
    try {
      const { data, error: dbError } = await createBrowserSupabase()
        .from('store_settings')
        .update({
          shipping_enabled: shippingEnabled,
          pickup_enabled: pickupEnabled,
          shipping_flat_fee: shippingFee,
          free_shipping_threshold: threshold,
          pickup_instructions: pickupInstructions.trim() || null,
        })
        .eq('id', 1)
        .select('id')
        .single();
      if (dbError) throw dbError;
      if (!data) throw new Error('Teslimat ayarları kaydedilemedi.');
      setSuccess('Teslimat seçenekleri kaydedildi; sepet ve sipariş ekranlarına yansıyacak.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ayar kaydedilemedi.');
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await createBrowserSupabase().auth.signOut();
    router.replace('/admin/giris');
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <div className="admin-top">
          <Link href="/">
            <ArrowLeft size={16} /> Mağazaya dön
          </Link>
          <button className="admin-logout" type="button" onClick={() => void logout()}>
            <LogOut size={16} /> Çıkış yap
          </button>
        </div>
        <div className="admin-body">
          <main className="delivery-admin-page">
            <div className="admin-page-heading">
              <div>
                <span className="section-eyebrow">ÖZ KIRTASİYE · TESLİMAT</span>
                <h1>
                  Kargo ve mağazadan teslim<span className="orange-dot">.</span>
                </h1>
                <p>
                  Ücretleri sen belirlersin. Etkinleştirmediğin teslimat yöntemi müşteriye
                  gösterilmez.
                </p>
              </div>
            </div>
            {error && (
              <div className="admin-form-error" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="admin-form-success" role="status">
                {success}
              </div>
            )}
            <form className="settings-form" onSubmit={(event) => void save(event)}>
              <section className="admin-content-box settings-section">
                <div className="settings-section-title">
                  <h2>
                    <Truck size={19} /> Kargo ile gönderim
                  </h2>
                  <p>Ücret henüz net değilse bu seçeneği kapalı tut.</p>
                </div>
                <label className="delivery-toggle">
                  <input
                    type="checkbox"
                    checked={shippingEnabled}
                    onChange={(e) => setShippingEnabled(e.target.checked)}
                  />{' '}
                  Kargoyla teslimat aktif
                </label>
                <div className="settings-grid">
                  <label className="admin-field">
                    Sabit kargo ücreti (TL)
                    <input
                      inputMode="decimal"
                      placeholder="Örn. 79,90"
                      value={flatFee}
                      onChange={(e) => setFlatFee(e.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    Ücretsiz kargo limiti (TL, isteğe bağlı)
                    <input
                      inputMode="decimal"
                      placeholder="Boş bırakılırsa ücretsiz kargo yok"
                      value={freeThreshold}
                      onChange={(e) => setFreeThreshold(e.target.value)}
                    />
                  </label>
                </div>
                <div className="delivery-preview">
                  Örnek: <strong>500 TL ürün sepeti</strong> için kargo{' '}
                  <strong>
                    {shippingPreview.available && shippingPreview.fee !== null
                      ? formatPrice(shippingPreview.fee)
                      : 'Kapalı'}
                  </strong>
                  .
                </div>
                <p className="delivery-help">
                  Bu sürüm sabit kargo ücreti uygular. İl/ilçe, desi veya taşıyıcı bazlı farklı
                  fiyatlandırma henüz yoktur.
                </p>
              </section>
              <section className="admin-content-box settings-section">
                <div className="settings-section-title">
                  <h2>
                    <Store size={19} /> Mağazadan teslim
                  </h2>
                  <p>
                    Müşteri gelip ürünü işletmeden teslim alabilecekse aç. Bu yöntemde kargo bedeli
                    sıfırdır.
                  </p>
                </div>
                <label className="delivery-toggle">
                  <input
                    type="checkbox"
                    checked={pickupEnabled}
                    onChange={(e) => setPickupEnabled(e.target.checked)}
                  />{' '}
                  Mağazadan teslim aktif
                </label>
                <div className="delivery-pickup-address">
                  Teslim noktası: <strong>{initialSettings.registered_address}</strong>
                  <br />
                  <small>
                    Adres değişikliği için <Link href="/admin/ayarlar">işletme ayarlarına</Link>{' '}
                    git.
                  </small>
                </div>
                <label className="admin-field delivery-instructions">
                  Müşteriye teslim alma açıklaması (isteğe bağlı)
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={pickupInstructions}
                    onChange={(e) => setPickupInstructions(e.target.value)}
                    placeholder="Örn. Hazır olduğunda telefonla bilgilendireceğiz. Sipariş numaranızı belirtin."
                  />
                </label>
              </section>
              {!shippingEnabled && !pickupEnabled && (
                <p className="admin-form-error">
                  Her iki yöntem de kapalı: Müşteriler sipariş talebi gönderemez.
                </p>
              )}
              <div className="settings-form-actions">
                <button disabled={pending} type="submit" className="button button-primary">
                  <Save size={17} />
                  {pending ? 'Kaydediliyor...' : 'Teslimat ayarlarını kaydet'}
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
