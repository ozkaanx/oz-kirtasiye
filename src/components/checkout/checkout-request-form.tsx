'use client';

import { cartLineKey } from '@/lib/cart-types';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, MapPin, Package, Store, Truck } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { formatPrice } from '@/lib/format';
import type { OrderRequestResult } from '@/lib/cart-types';
import { LEGAL_DOCUMENT_VERSION } from '@/lib/store-profile';
import { deliveryQuote, type DeliveryMethod, type DeliverySettings } from '@/lib/delivery';
import styles from './delivery-options.module.css';
import type { CustomerAddress, CustomerProfile } from '@/lib/customer';
import { InvoiceDetails } from './invoice-details';
import { createInvoiceForm, getInvoiceBilling } from '@/lib/invoice-billing';
import { CouponBox } from '@/components/coupons/coupon-box';
import { useCouponQuote } from '@/components/coupons/use-coupon-quote';

type Fields = { customerName: string; phone: string; city: string; district: string; address: string; note: string };
const empty: Fields = { customerName: '', phone: '', city: 'İstanbul', district: '', address: '', note: '' };

export function CheckoutRequestForm({ enabled, settings, savedAddresses, profile, loggedIn }: { enabled: boolean; settings: DeliverySettings; savedAddresses: CustomerAddress[]; profile: CustomerProfile | null; loggedIn: boolean }) {
  const { cart, products, cartLoading, cartError, cartIsValid, cartSubtotal, couponCode, refreshCart, clearCart } = useShop();
  const preferredAddress = savedAddresses.find((address) => address.is_default) ?? savedAddresses[0] ?? null;
  const [fields, setFields] = useState<Fields>(() => ({
    ...empty,
    customerName: profile?.full_name?.trim() || preferredAddress?.recipient_name || '',
    phone: profile?.phone?.trim() || preferredAddress?.phone || '',
  }));
  const [selectedAddressId, setSelectedAddressId] = useState(() => preferredAddress?.id ?? '');
  const [invoiceForm, setInvoiceForm] = useState(() => createInvoiceForm(savedAddresses));
  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const [method, setMethod] = useState<DeliveryMethod>(settings.shipping_enabled ? 'shipping' : 'pickup');
  const [privacyRead, setPrivacyRead] = useState(false);
  const [preInformationRead, setPreInformationRead] = useState(false);
  const [website, setWebsite] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<OrderRequestResult | null>(null);
  const quote = deliveryQuote(settings, cartSubtotal, method);
  const promo = useCouponQuote(cart, method);
  const couponBlocked = !!couponCode && (promo.loading || !!promo.error || !promo.quote);
  const anyMethodAvailable = settings.shipping_enabled || settings.pickup_enabled;
  const hasSavedShippingAddress = loggedIn && method === 'shipping' && selectedAddress !== null;
  const showContactForm = method === 'pickup' || !hasSavedShippingAddress;
  const showShippingAddressForm = method === 'shipping' && !hasSavedShippingAddress;

  function update(field: keyof Fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || !quote.available || !privacyRead || !preInformationRead || pending || !cartIsValid || couponBlocked) return;
    if (loggedIn && method === 'shipping' && savedAddresses.length > 0 && !selectedAddress) {
      setError('Lütfen geçerli bir teslimat adresi seç.');
      return;
    }
    // Saved addresses always supply the order payload directly; never rely on stale, hidden inputs.
    const orderFields: Fields = hasSavedShippingAddress && selectedAddress
      ? {
          ...fields,
          customerName: selectedAddress.recipient_name,
          phone: selectedAddress.phone,
          city: selectedAddress.city,
          district: selectedAddress.district,
          address: selectedAddress.address,
        }
      : fields;
    setError('');
    let billing;
    try {
      billing = getInvoiceBilling(
        {
          ...invoiceForm,
          addressMode: method === 'pickup' && invoiceForm.addressMode === 'delivery'
            ? (savedAddresses.length ? 'saved' : 'manual')
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
    setPending(true);
    try {
      // Browser estimates can be stale. The Postgres function validates final prices, stock and fee atomically.
      await refreshCart();
      const response = await fetch('/api/order-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderFields,
          website,
          items: cart,
          deliveryMethod: method,
          billing,
          couponCode: couponCode || null,
          privacyNoticeRead: privacyRead,
          preInformationRead,
          noticeVersion: LEGAL_DOCUMENT_VERSION,
        }),
      });
      const result: OrderRequestResult & { message?: string } = await response.json();
      if (!response.ok) throw new Error(result.message || 'Sipariş talebi oluşturulamadı.');
      setCompleted(result);
      clearCart();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Beklenmeyen hata oluştu.');
    } finally {
      setPending(false);
    }
  }

  if (completed) return (
    <section className="container-wide checkout-finished">
      <CheckCircle2 size={62} />
      <h1>Talebin kaydedildi!</h1>
      <p>Talep numaran <strong>{completed.reference}</strong>. Mağazamız seninle iletişime geçerek hazırlık ve ödeme seçeneklerini netleştirecek.</p>
      <p><strong>{completed.deliveryMethod === 'pickup' ? 'Mağazadan teslim' : 'Kargo teslimatı'}</strong> · Ürünler: {formatPrice(completed.subtotal)} {completed.discountAmount > 0 && <>· {completed.couponCode ? 'Kupon' : 'Kampanya'} indirimi: −{formatPrice(completed.discountAmount)} </>}· Kargo: {formatPrice(completed.shippingFee)} · <strong>Toplam: {formatPrice(completed.total)}</strong></p>
      <p><strong>Henüz ödeme alınmadı ve stok ayrılmadı.</strong></p>
      <Link className="button button-primary" href="/urunler">Alışverişe devam et <ArrowRight size={17} /></Link>
    </section>
  );

  return (
    <section className="container-wide checkout-page">
      <div className="breadcrumbs"><Link href="/sepet"><ArrowLeft size={15} /> Sepete dön</Link></div>
      <span className="section-eyebrow">ÖZ KIRTASİYE</span>
      <h1>Sipariş talebi<span className="orange-dot">.</span></h1>
      <p className="checkout-intro">Bu form <strong>ödeme sayfası değildir.</strong> Sipariş talebini mağazaya iletir; stok ayrılmaz ve ödeme alınmaz.</p>
      {!enabled && <div role="status" className="checkout-info-banner">Sipariş talebi gönderimi henüz açılmadı. Sepetini hazırlayabilirsin; mağaza ayarları tamamlanınca bu alan aktif olacak.</div>}
      {!anyMethodAvailable && <div role="status" className="checkout-info-banner">Kargo ve mağazadan teslim henüz ayarlanmadı. Sipariş talebi göndermek şu anda mümkün değil.</div>}
      <div className="checkout-grid">
        <form className="checkout-customer" onSubmit={submit}>
          <h2>İletişim ve teslimat bilgilerin</h2>
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
                <span className={styles.icon}><Truck size={21} aria-hidden="true" /></span>
                <span className={styles.content}>
                  <strong className={styles.title}>Kargo ile teslimat</strong>
                  <small className={styles.subtitle}>Adresine gönderim</small>
                </span>
                <span className={styles.price}>
                  {formatPrice(deliveryQuote(settings, cartSubtotal, 'shipping').fee ?? 0)}
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
                <span className={styles.icon}><Store size={21} aria-hidden="true" /></span>
                <span className={styles.content}>
                  <strong className={styles.title}>Mağazadan teslim</strong>
                  <small className={styles.subtitle}>Öz Kırtasiye'ye gelip al</small>
                </span>
                <span className={styles.price}>Ücretsiz</span>
              </label>
            )}
          </fieldset>
          {method === 'pickup' && settings.pickup_enabled && <aside className="delivery-pickup-address">
            <strong>Teslim alınacak adres</strong>
            <p>{settings.registered_address}</p>
            {settings.pickup_instructions && <p>{settings.pickup_instructions}</p>}
            <small>Ürünler hazır olduğunda mağazayla görüşerek teslim alabilirsin.</small>
          </aside>}
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
                        <span>{selectedAddress.recipient_name} · {selectedAddress.phone}</span>
                        <span>{selectedAddress.address}, {selectedAddress.district} / {selectedAddress.city}</span>
                      </div>
                      <CheckCircle2 size={19} aria-label="Seçili adres" className={styles.addressSummaryCheck} />
                    </div>
                  )}
                </>
              ) : (
                <p className={styles.noSavedAddress}>
                  Kayıtlı adresin bulunmuyor. Teslimat bilgilerini aşağıya doldurabilirsin.
                  Sonraki alışverişlerinde kullanmak için <Link href="/hesabim">adres defterine ekleyebilirsin.</Link>
                </p>
              )}
            </section>
          )}
          {!loggedIn && (
            <p className={styles.guestInfo}>
              Üye olmadan devam edebilirsin. <Link href="/giris?next=%2Fsiparis">Giriş yaparsan</Link> kayıtlı adreslerini seçebilirsin.
            </p>
          )}
          {method === 'pickup' && <p className={styles.pickupContactHint}>Siparişi mağazadan teslim alacak kişinin adı ve telefonunu yaz.</p>}
          {showContactForm && (
            <div className="checkout-two-cols">
              <label>
                Ad soyad
                <input required minLength={3} maxLength={100} autoComplete="name" value={fields.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="Adınız Soyadınız" />
              </label>
              <label>
                Telefon
                <input required type="tel" minLength={10} maxLength={20} autoComplete="tel" value={fields.phone} onChange={(event) => update('phone', event.target.value)} placeholder="05XX XXX XX XX" />
              </label>
              {showShippingAddressForm && (
                <>
                  <label>
                    İl
                    <input required minLength={2} maxLength={80} autoComplete="address-level1" value={fields.city} onChange={(event) => update('city', event.target.value)} />
                  </label>
                  <label>
                    İlçe
                    <input required minLength={2} maxLength={80} autoComplete="address-level2" value={fields.district} onChange={(event) => update('district', event.target.value)} placeholder="Bağcılar" />
                  </label>
                </>
              )}
            </div>
          )}
          {showShippingAddressForm && (
            <label>
              Açık adres
              <textarea required minLength={10} maxLength={500} autoComplete="street-address" rows={4} value={fields.address} onChange={(event) => update('address', event.target.value)} placeholder="Mahalle, sokak, bina ve daire numarası" />
            </label>
          )}
          <InvoiceDetails
            value={invoiceForm}
            onChange={setInvoiceForm}
            deliveryMethod={method}
            addresses={savedAddresses}
            recipientName={hasSavedShippingAddress && selectedAddress ? selectedAddress.recipient_name : fields.customerName}
          />
          <label>Sipariş notu (isteğe bağlı)<textarea maxLength={500} rows={3} value={fields.note} onChange={(e) => update('note', e.target.value)} placeholder="Ürünlerle ilgili belirtmek istediğiniz bir şey var mı?" /></label>
          <label className="checkout-honeypot" aria-hidden="true">Web sitesi<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          <label className="checkout-consent"><input type="checkbox" required checked={privacyRead} onChange={(e) => setPrivacyRead(e.target.checked)} /><span><Link href="/gizlilik" target="_blank" rel="noopener noreferrer">KVKK aydınlatma metnini</Link> okudum. Sipariş talebim için iletişim ve teslimat bilgilerimin işleneceğini anladım. Bu işaretleme reklam izni değildir.</span></label>
          <label className="checkout-consent"><input type="checkbox" required checked={preInformationRead} onChange={(e) => setPreInformationRead(e.target.checked)} /><span><Link href="/on-bilgilendirme" target="_blank" rel="noopener noreferrer">Ön bilgilendirmeyi</Link> ve <Link href="/teslimat-iade" target="_blank" rel="noopener noreferrer">teslimat/iade açıklamalarını</Link> inceledim. Bunun ödeme alınmayan ve kesin satış oluşturmayan bir talep olduğunu biliyorum.</span></label>
          {error && <div className="admin-form-error" role="alert">{error}</div>}
          {cartError && <div className="admin-form-error" role="alert">{cartError}</div>}
          <button className="button button-primary checkout-submit" type="submit" disabled={pending || !enabled || !quote.available || !privacyRead || !preInformationRead || !cartIsValid || couponBlocked}>
            {pending ? 'Talebin kaydediliyor...' : 'Sipariş talebini gönder'} <ArrowRight size={17} />
          </button>
          <p className="checkout-legal-note"><LockKeyhole size={15} /> Kart bilgisi istenmez. Gösterilen kargo bedeli talep anında sunucuda doğrulanır; tahsilat ayrıca netleştirilir.</p>
        </form>
        <aside className="checkout-summary">
          <h2>Sepet özeti</h2>
          {cartLoading ? <p>Ürünler kontrol ediliyor...</p> : !cart.length ? <p>Sepetin boş. <Link href="/urunler">Ürün seç.</Link></p> : null}
          {cart.map((line) => {
            const product = products[cartLineKey(line.productId,line.variantId)];
            return <div key={cartLineKey(line.productId,line.variantId)} className="checkout-summary-line">
              {product?.imageUrl ? <img src={product.imageUrl} alt="" /> : <Package size={31} color="#9ba3ae" />}
              <div><strong>{product?.name || 'Ürün bulunamadı'}</strong>{product?.variantLabel && <small>{product.variantLabel}</small>}<small>{line.quantity} adet {product && line.quantity > product.stock_quantity ? '— stok yetersiz' : ''}</small></div>
              <b>{product ? formatPrice(product.price * line.quantity) : '—'}</b>
            </div>;
          })}
          <CouponBox {...promo} />
          <div className="delivery-summary-row"><span>Ürünler</span><b>{formatPrice(cartSubtotal)}</b></div>
          {promo.quote && promo.quote.discountAmount > 0 && <div className="delivery-summary-row"><span>{promo.quote.code ? `Kupon indirimi (${promo.quote.code})` : `Kampanya indirimi (${promo.quote.campaignName})`}</span><b>−{formatPrice(promo.quote.discountAmount)}</b></div>}
          <div className="delivery-summary-row"><span>{method === 'pickup' ? 'Mağazadan teslim' : 'Kargo bedeli'}</span><b>{quote.fee === null ? 'Mevcut değil' : formatPrice(promo.quote ? promo.quote.shippingFee : quote.fee)}</b></div>
          <div className="checkout-total"><span>Tahmini toplam</span><strong>{quote.total === null ? '—' : formatPrice(promo.quote ? promo.quote.total : quote.total)}</strong></div>
          {method === 'shipping' && !promo.quote && quote.freeShippingRemaining !== null && <small>Ücretsiz kargoya {formatPrice(quote.freeShippingRemaining)} kaldı.</small>}
          <small>Ürün fiyatları, stok ve kargo tutarı talep gönderilirken yeniden doğrulanır. Ödeme alınmaz.</small>
        </aside>
      </div>
    </section>
  );
}
