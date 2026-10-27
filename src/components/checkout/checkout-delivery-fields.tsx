'use client';
import Link from 'next/link';
import { Truck, Store, MapPin, CheckCircle2 } from 'lucide-react';
import { deliveryQuote, type DeliveryMethod, type DeliverySettings } from '@/lib/delivery';
import { formatPrice } from '@/lib/format';
import type { CustomerAddress } from '@/lib/customer';
import type { CheckoutFields } from '@/lib/checkout-form';
import styles from './delivery-options.module.css';
type Props = {
  settings: DeliverySettings;
  method: DeliveryMethod;
  setMethod: (value: DeliveryMethod) => void;
  netSubtotal: number;
  loggedIn: boolean;
  savedAddresses: CustomerAddress[];
  selectedAddressId: string;
  setSelectedAddressId: (value: string) => void;
  fields: CheckoutFields;
  update: (field: keyof CheckoutFields, value: string) => void;
};
export function CheckoutDeliveryFields({
  settings,
  method,
  setMethod,
  netSubtotal,
  loggedIn,
  savedAddresses,
  selectedAddressId,
  setSelectedAddressId,
  fields,
  update,
}: Props) {
  const selectedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const hasSavedShippingAddress = loggedIn && method === 'shipping' && selectedAddress !== null;
  const showContactForm = method === 'pickup' || !hasSavedShippingAddress;
  const showShippingAddressForm = method === 'shipping' && !hasSavedShippingAddress;
  return (
    <>
      {' '}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Teslimat yöntemini seç</legend>
        {settings.shipping_enabled && (
          <label className={styles.option} data-selected={method === 'shipping'}>
            <input
              className={styles.radio}
              type="radio"
              name="delivery"
              value="shipping"
              checked={method === 'shipping'}
              onChange={() => setMethod('shipping')}
            />
            <span className={styles.icon}>
              <Truck size={21} aria-hidden="true" />
            </span>
            <span className={styles.content}>
              <strong className={styles.title}>Kargo ile teslimat</strong>
              <small className={styles.subtitle}>Adresine gönderim</small>
            </span>
            <span className={styles.price}>
              {formatPrice(deliveryQuote(settings, netSubtotal, 'shipping').fee ?? 0)}
            </span>
          </label>
        )}
        {settings.pickup_enabled && (
          <label className={styles.option} data-selected={method === 'pickup'}>
            <input
              className={styles.radio}
              type="radio"
              name="delivery"
              value="pickup"
              checked={method === 'pickup'}
              onChange={() => setMethod('pickup')}
            />
            <span className={styles.icon}>
              <Store size={21} aria-hidden="true" />
            </span>
            <span className={styles.content}>
              <strong className={styles.title}>Mağazadan teslim</strong>
              <small className={styles.subtitle}>Öz Kırtasiye&apos;ye gelip al</small>
            </span>
            <span className={styles.price}>Ücretsiz</span>
          </label>
        )}
      </fieldset>
      {method === 'pickup' && settings.pickup_enabled && (
        <aside className="delivery-pickup-address">
          <strong>Teslim alınacak adres</strong>
          <p>{settings.registered_address}</p>
          {settings.pickup_instructions && <p>{settings.pickup_instructions}</p>}
          <small>Ürünler hazır olduğunda mağazayla görüşerek teslim alabilirsin.</small>
        </aside>
      )}
      {loggedIn && method === 'shipping' && (
        <section className={styles.savedAddressBox} aria-label="Kayıtlı teslimat adresleri">
          <div className={styles.savedAddressHeading}>
            <strong>Teslimat adresim</strong>
            <Link href="/hesabim">Adreslerimi yönet</Link>
          </div>
          {savedAddresses.length > 0 ? (
            <>
              <label className={styles.savedAddressLabel}>
                Kayıtlı adres seç
                <select
                  className={styles.savedAddressSelect}
                  value={selectedAddressId}
                  onChange={(event) => setSelectedAddressId(event.target.value)}
                >
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} — {address.district} / {address.city}
                      {address.is_default ? ' (Varsayılan)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {selectedAddress && (
                <div className={styles.addressSummary} aria-live="polite">
                  <MapPin size={19} aria-hidden="true" className={styles.addressSummaryIcon} />
                  <div className={styles.addressSummaryDetails}>
                    <strong>{selectedAddress.label}</strong>
                    <span>
                      {selectedAddress.recipient_name} · {selectedAddress.phone}
                    </span>
                    <span>
                      {selectedAddress.address}, {selectedAddress.district} / {selectedAddress.city}
                    </span>
                  </div>
                  <CheckCircle2
                    size={19}
                    aria-label="Seçili adres"
                    className={styles.addressSummaryCheck}
                  />
                </div>
              )}
            </>
          ) : (
            <p className={styles.noSavedAddress}>
              Kayıtlı adresin bulunmuyor. Teslimat bilgilerini aşağıya doldurabilirsin. Sonraki
              alışverişlerinde kullanmak için{' '}
              <Link href="/hesabim">adres defterine ekleyebilirsin.</Link>
            </p>
          )}
        </section>
      )}
      {!loggedIn && (
        <p className={styles.guestInfo}>
          Üye olmadan devam edebilirsin. <Link href="/giris?next=%2Fsiparis">Giriş yaparsan</Link>{' '}
          kayıtlı adreslerini seçebilirsin.
        </p>
      )}
      {method === 'pickup' && (
        <p className={styles.pickupContactHint}>
          Siparişi mağazadan teslim alacak kişinin adı ve telefonunu yaz.
        </p>
      )}
      {showContactForm && (
        <div className="checkout-two-cols">
          <label>
            Ad soyad
            <input
              required
              minLength={3}
              maxLength={100}
              autoComplete="name"
              value={fields.customerName}
              onChange={(event) => update('customerName', event.target.value)}
              placeholder="Adınız Soyadınız"
            />
          </label>
          <label>
            Telefon
            <input
              required
              type="tel"
              minLength={10}
              maxLength={20}
              autoComplete="tel"
              value={fields.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="05XX XXX XX XX"
            />
          </label>
          {showShippingAddressForm && (
            <>
              <label>
                İl
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="address-level1"
                  value={fields.city}
                  onChange={(event) => update('city', event.target.value)}
                />
              </label>
              <label>
                İlçe
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="address-level2"
                  value={fields.district}
                  onChange={(event) => update('district', event.target.value)}
                  placeholder="Bağcılar"
                />
              </label>
            </>
          )}
        </div>
      )}
      {showShippingAddressForm && (
        <label>
          Açık adres
          <textarea
            required
            minLength={10}
            maxLength={500}
            autoComplete="street-address"
            rows={4}
            value={fields.address}
            onChange={(event) => update('address', event.target.value)}
            placeholder="Mahalle, sokak, bina ve daire numarası"
          />
        </label>
      )}
    </>
  );
}
