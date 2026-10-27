'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { useShop } from '@/context/shop-context';

import { LEGAL_DOCUMENT_VERSION } from '@/lib/store-profile';
import type { DeliveryMethod, DeliverySettings } from '@/lib/delivery';

import type { CustomerAddress, CustomerProfile } from '@/lib/customer';
import { InvoiceDetails } from './invoice-details';
import { createInvoiceForm, getInvoiceBilling } from '@/lib/invoice-billing';

import { useCartPricing } from '@/components/coupons/use-cart-pricing';
import { useOrderSubmission } from './use-order-submission';
import { CheckoutCompleted } from './checkout-completed';
import { CheckoutDeliveryFields } from './checkout-delivery-fields';
import { CheckoutSummary } from './checkout-summary';
import { resolveDeliveryFields, type CheckoutFields as Fields } from '@/lib/checkout-form';

const empty: Fields = {
  customerName: '',
  phone: '',
  city: 'İstanbul',
  district: '',
  address: '',
  note: '',
};

export function CheckoutRequestForm({
  enabled,
  settings,
  savedAddresses,
  profile,
  loggedIn,
}: {
  enabled: boolean;
  settings: DeliverySettings;
  savedAddresses: CustomerAddress[];
  profile: CustomerProfile | null;
  loggedIn: boolean;
}) {
  const {
    cart,
    products,
    cartLoading,
    cartError,
    cartIsValid,
    couponCode,
    refreshCart,
    clearCart,
  } = useShop();
  const preferredAddress =
    savedAddresses.find((address) => address.is_default) ?? savedAddresses[0] ?? null;
  const [fields, setFields] = useState<Fields>(() => ({
    ...empty,
    customerName: profile?.full_name?.trim() || preferredAddress?.recipient_name || '',
    phone: profile?.phone?.trim() || preferredAddress?.phone || '',
  }));
  const [selectedAddressId, setSelectedAddressId] = useState(() => preferredAddress?.id ?? '');
  const [invoiceForm, setInvoiceForm] = useState(() => createInvoiceForm(savedAddresses));
  const selectedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const [method, setMethod] = useState<DeliveryMethod>(
    settings.shipping_enabled ? 'shipping' : 'pickup',
  );
  const [privacyRead, setPrivacyRead] = useState(false);
  const [preInformationRead, setPreInformationRead] = useState(false);
  const [website, setWebsite] = useState('');
  const { pending, error, setError, completed, send } = useOrderSubmission({
    refreshCart,
    clearCart,
  });
  const { promo, pricing } = useCartPricing(settings, method);
  const quote = pricing.delivery;
  const couponBlocked = pricing.couponBlocked;
  const anyMethodAvailable = settings.shipping_enabled || settings.pickup_enabled;
  const hasSavedShippingAddress = loggedIn && method === 'shipping' && selectedAddress !== null;

  function update(field: keyof Fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !enabled ||
      !quote.available ||
      !privacyRead ||
      !preInformationRead ||
      pending ||
      !cartIsValid ||
      couponBlocked
    )
      return;
    if (loggedIn && method === 'shipping' && savedAddresses.length > 0 && !selectedAddress) {
      setError('Lütfen geçerli bir teslimat adresi seç.');
      return;
    }
    // Saved addresses always supply the order payload directly; never rely on stale, hidden inputs.
    const orderFields = resolveDeliveryFields(fields, selectedAddress, method, loggedIn);
    setError('');
    let billing;
    try {
      billing = getInvoiceBilling(
        {
          ...invoiceForm,
          addressMode:
            method === 'pickup' && invoiceForm.addressMode === 'delivery'
              ? savedAddresses.length
                ? 'saved'
                : 'manual'
              : invoiceForm.addressMode,
        },
        method,
        orderFields,
        savedAddresses,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fatura bilgilerini kontrol et.');
      return;
    }
    await send({
      ...orderFields,
      website,
      items: cart,
      deliveryMethod: method,
      billing,
      couponCode: couponCode || null,
      privacyNoticeRead: privacyRead,
      preInformationRead,
      noticeVersion: LEGAL_DOCUMENT_VERSION,
    });
  }

  if (completed) return <CheckoutCompleted result={completed} />;

  return (
    <section className="container-wide checkout-page">
      <div className="breadcrumbs">
        <Link href="/sepet">
          <ArrowLeft size={15} /> Sepete dön
        </Link>
      </div>
      <span className="section-eyebrow">ÖZ KIRTASİYE</span>
      <h1>
        Sipariş talebi<span className="orange-dot">.</span>
      </h1>
      <p className="checkout-intro">
        Bu form <strong>ödeme sayfası değildir.</strong> Sipariş talebini mağazaya iletir; stok
        ayrılmaz ve ödeme alınmaz.
      </p>
      {!enabled && (
        <div role="status" className="checkout-info-banner">
          Sipariş talebi gönderimi henüz açılmadı. Sepetini hazırlayabilirsin; mağaza ayarları
          tamamlanınca bu alan aktif olacak.
        </div>
      )}
      {!anyMethodAvailable && (
        <div role="status" className="checkout-info-banner">
          Kargo ve mağazadan teslim henüz ayarlanmadı. Sipariş talebi göndermek şu anda mümkün
          değil.
        </div>
      )}
      <div className="checkout-grid">
        <form className="checkout-customer" onSubmit={submit}>
          <h2>İletişim ve teslimat bilgilerin</h2>
          <CheckoutDeliveryFields
            settings={settings}
            method={method}
            setMethod={setMethod}
            netSubtotal={pricing.netSubtotal}
            loggedIn={loggedIn}
            savedAddresses={savedAddresses}
            selectedAddressId={selectedAddressId}
            setSelectedAddressId={setSelectedAddressId}
            fields={fields}
            update={update}
          />
          <InvoiceDetails
            value={invoiceForm}
            onChange={setInvoiceForm}
            deliveryMethod={method}
            addresses={savedAddresses}
            recipientName={
              hasSavedShippingAddress && selectedAddress
                ? selectedAddress.recipient_name
                : fields.customerName
            }
          />
          <label>
            Sipariş notu (isteğe bağlı)
            <textarea
              maxLength={500}
              rows={3}
              value={fields.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="Ürünlerle ilgili belirtmek istediğiniz bir şey var mı?"
            />
          </label>
          <label className="checkout-honeypot" aria-hidden="true">
            Web sitesi
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
          <label className="checkout-consent">
            <input
              type="checkbox"
              required
              checked={privacyRead}
              onChange={(e) => setPrivacyRead(e.target.checked)}
            />
            <span>
              <Link href="/gizlilik" target="_blank" rel="noopener noreferrer">
                KVKK aydınlatma metnini
              </Link>{' '}
              okudum. Sipariş talebim için iletişim ve teslimat bilgilerimin işleneceğini anladım.
              Bu işaretleme reklam izni değildir.
            </span>
          </label>
          <label className="checkout-consent">
            <input
              type="checkbox"
              required
              checked={preInformationRead}
              onChange={(e) => setPreInformationRead(e.target.checked)}
            />
            <span>
              <Link href="/on-bilgilendirme" target="_blank" rel="noopener noreferrer">
                Ön bilgilendirmeyi
              </Link>{' '}
              ve{' '}
              <Link href="/teslimat-iade" target="_blank" rel="noopener noreferrer">
                teslimat/iade açıklamalarını
              </Link>{' '}
              inceledim. Bunun ödeme alınmayan ve kesin satış oluşturmayan bir talep olduğunu
              biliyorum.
            </span>
          </label>
          {error && (
            <div className="admin-form-error" role="alert">
              {error}
            </div>
          )}
          {cartError && (
            <div className="admin-form-error" role="alert">
              {cartError}
            </div>
          )}
          <button
            className="button button-primary checkout-submit"
            type="submit"
            disabled={
              pending ||
              !enabled ||
              !quote.available ||
              !privacyRead ||
              !preInformationRead ||
              !cartIsValid ||
              couponBlocked
            }
          >
            {pending ? 'Talebin kaydediliyor...' : 'Sipariş talebini gönder'}{' '}
            <ArrowRight size={17} />
          </button>
          <p className="checkout-legal-note">
            <LockKeyhole size={15} /> Kart bilgisi istenmez. Gösterilen kargo bedeli talep anında
            sunucuda doğrulanır; tahsilat ayrıca netleştirilir.
          </p>
        </form>
        <CheckoutSummary
          cart={cart}
          products={products}
          cartLoading={cartLoading}
          method={method}
          pricing={pricing}
          promo={promo}
        />
      </div>
    </section>
  );
}
