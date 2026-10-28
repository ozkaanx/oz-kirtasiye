'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  Check,
  ChevronDown,
  Home,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  UserRound,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { useShop } from '@/context/shop-context';
import { formatPrice } from '@/lib/format';
import { orderStatusPresentation, paymentStatusPresentation, type AccountTab } from '@/lib/account-ui';
import type { CustomerAddress, CustomerOrder, CustomerProfile } from '@/lib/customer';
import { AccountSidebar } from './account-sidebar';
import styles from './customer-account.module.css';
import { OrderJourney } from './order-journey';

type AddressFields = Pick<
  CustomerAddress,
  'label' | 'recipient_name' | 'phone' | 'city' | 'district' | 'address'
>;
const blankAddress: AddressFields = {
  label: 'Ev',
  recipient_name: '',
  phone: '',
  city: 'İstanbul',
  district: '',
  address: '',
};

type Props = {
  initialTab: AccountTab;
  userId: string;
  email: string;
  initialProfile: CustomerProfile;
  initialAddresses: CustomerAddress[];
  initialOrders: CustomerOrder[];
  loadError?: string;
};

export function CustomerAccount({
  initialTab,
  userId,
  email,
  initialProfile,
  initialAddresses,
  initialOrders,
  loadError,
}: Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const { couponCode, addToCart } = useShop();
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [profile, setProfile] = useState({
    full_name: initialProfile.full_name,
    phone: initialProfile.phone ?? '',
  });
  const [addresses, setAddresses] = useState<CustomerAddress[]>(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFields | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const addressTitleRef = useRef<HTMLInputElement>(null);
  const addressFormOpen = addressForm !== null;

  useEffect(() => {
    if (addressFormOpen) addressTitleRef.current?.focus();
  }, [addressFormOpen, editingId]);

  function message(errorText?: string, successText?: string) {
    setError(errorText ?? '');
    setSuccess(successText ?? '');
  }

  function changeTab(nextTab: AccountTab) {
    if (busy || nextTab === tab) return;
    setTab(nextTab);
    message();
    const nextUrl = nextTab === 'overview' ? '/hesabim' : `/hesabim?tab=${nextTab}`;
    window.history.replaceState(null, '', nextUrl);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    message();
    try {
      const { error: saveError } = await supabase.from('customer_profiles').upsert(
        {
          user_id: userId,
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim() || null,
        },
        { onConflict: 'user_id' },
      );
      if (saveError) throw new Error(saveError.message);
      message(undefined, 'Profil bilgilerin kaydedildi.');
    } catch (cause) {
      message(cause instanceof Error ? cause.message : 'Profil kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function reloadAddresses() {
    const { data, error: readError } = await supabase
      .from('customer_addresses')
      .select('id,user_id,label,recipient_name,phone,city,district,address,is_default,created_at')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (readError) throw new Error(readError.message);
    setAddresses((data ?? []) as CustomerAddress[]);
  }

  function editAddress(address: CustomerAddress) {
    setEditingId(address.id);
    setAddressForm({
      label: address.label,
      recipient_name: address.recipient_name,
      phone: address.phone,
      city: address.city,
      district: address.district,
      address: address.address,
    });
    message();
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressForm || busy) return;
    setBusy(true);
    message();
    try {
      const payload = {
        ...addressForm,
        label: addressForm.label.trim(),
        recipient_name: addressForm.recipient_name.trim(),
        phone: addressForm.phone.trim(),
        city: addressForm.city.trim(),
        district: addressForm.district.trim(),
        address: addressForm.address.trim(),
      };
      const { error: saveError } = editingId
        ? await supabase
            .from('customer_addresses')
            .update(payload)
            .eq('id', editingId)
            .eq('user_id', userId)
        : await supabase
            .from('customer_addresses')
            .insert({ ...payload, user_id: userId, is_default: false });
      if (saveError) throw new Error(saveError.message);
      await reloadAddresses();
      setAddressForm(null);
      setEditingId(null);
      message(undefined, 'Adres kaydedildi.');
    } catch (cause) {
      message(cause instanceof Error ? cause.message : 'Adres kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    if (busy) return;
    setBusy(true);
    message();
    try {
      const { error: rpcError } = await supabase.rpc('set_default_customer_address', {
        p_address_id: id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await reloadAddresses();
      message(undefined, 'Varsayılan adres güncellendi.');
    } catch (cause) {
      message(cause instanceof Error ? cause.message : 'Adres güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(id: string) {
    if (busy || !window.confirm('Bu adresi silmek istiyor musun?')) return;
    setBusy(true);
    message();
    try {
      const { error: deleteError } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (deleteError) throw new Error(deleteError.message);
      await reloadAddresses();
      message(undefined, 'Adres silindi.');
    } catch (cause) {
      message(cause instanceof Error ? cause.message : 'Adres silinemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      message(logoutError.message);
      setBusy(false);
      return;
    }
    router.replace('/giris');
    router.refresh();
  }

  function repeatOrder(order: CustomerOrder) {
    // Current cart remains intact. Fresh stock/prices are checked by the existing cart flow.
    const entries = order.order_request_items.filter(item => item.product_id && item.quantity > 0);
    if (!entries.length) {
      message('Bu siparişte yeniden eklenebilecek ürün bulunmuyor.');
      return;
    }
    if (!window.confirm('Bu siparişteki ürünler mevcut sepetine eklensin mi? Güncel fiyat ve stok yeniden kontrol edilecek.')) return;
    for (const item of entries.slice(0, 20)) {
      addToCart(item.product_id, Math.min(item.quantity, 99), item.variant_id);
    }
    message(undefined, 'Ürünler sepetine eklendi. Güncel fiyat ve stok bilgilerini kontrol et.');
  }

  return (
    <section className={`container-wide ${styles.page}`}>
      <div className={styles.pageHeader}>
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE / HESABIM</span>
          <h1>
            Merhaba{profile.full_name.trim() ? `, ${profile.full_name.trim().split(/\s+/)[0]}` : ''}
            <span className="orange-dot">.</span>
          </h1>
          <p>Hesap bilgilerin, adreslerin ve sipariş taleplerin tek bir yerde.</p>
        </div>
        <button type="button" className={styles.logout} onClick={logout} disabled={busy}>
          <LogOut size={17} aria-hidden="true" /> {busy ? 'İşleniyor...' : 'Çıkış yap'}
        </button>
      </div>
      <div className={styles.shell}>
        <AccountSidebar active={tab} onAccountTabChange={changeTab} disabled={busy} />
        <div className={styles.panel} id="account-content-panel" role="region" aria-label="Hesap içeriği">
          {loadError && (
            <p role="alert" className={styles.error}>{loadError}</p>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {success && (
            <p role="status" className={styles.success}>
              {success}
            </p>
          )}
          {tab === 'overview' && (
            <>
              <div className={styles.quickGrid} role="group" aria-label="Hesap özeti">
                <button type="button" disabled={busy} onClick={() => changeTab('orders')} className={styles.quickCard}>
                  <span className={styles.quickIcon}><Package size={20} aria-hidden="true" /></span>
                  <strong>{loadError ? '—' : initialOrders.length}</strong>
                  <span>Son sipariş taleplerim</span>
                  <ArrowRight size={17} className={styles.quickArrow} aria-hidden="true" />
                </button>
                <button type="button" disabled={busy} onClick={() => changeTab('addresses')} className={styles.quickCard}>
                  <span className={styles.quickIcon}><MapPin size={20} aria-hidden="true" /></span>
                  <strong>{loadError ? '—' : addresses.length}</strong>
                  <span>Kayıtlı adreslerim</span>
                  <ArrowRight size={17} className={styles.quickArrow} aria-hidden="true" />
                </button>
              </div>
              <Link href="/hesabim/avantajlar" className={styles.benefitsBanner}>
                <span className={styles.benefitsIcon}><BadgePercent size={25} aria-hidden="true" /></span>
                <span className={styles.benefitsCopy}>
                  <strong>Avantajlarım ve kuponlarım</strong>
                  <small>{couponCode ? `Sepetinde ${couponCode} kupon kodu kayıtlı. İndirimi kontrol et.` : 'Kuponlarını görüntüle, kodunu sepetine kaydet ve kullan.'}</small>
                </span>
                <ArrowRight size={19} aria-hidden="true" className={styles.benefitsArrow} />
              </Link>
              <div className={styles.sectionTop}>
                <div>
                  <h2>Kişisel bilgilerim</h2>
                  <p>İletişim bilgilerini buradan güncelleyebilirsin.</p>
                </div>
                <UserRound size={25} />
              </div>
              <form onSubmit={saveProfile} className={`${styles.form} ${styles.profileForm}`}>
                <label>
                  E-posta
                  <input disabled value={email} type="email" autoComplete="email" />
                  <small>E-posta değişikliği bu ekrandan yapılmıyor.</small>
                </label>
                <div className={styles.formGrid}>
                  <label>
                    Ad soyad
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    autoComplete="name"
                    value={profile.full_name}
                    onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  />
                </label>
                <label>
                  Telefon
                  <input
                    type="tel"
                    minLength={10}
                    maxLength={20}
                    autoComplete="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  />
                </label>
                </div>
                <button type="submit" className="button button-primary" disabled={busy}>
                  {busy ? 'Kaydediliyor...' : 'Bilgileri kaydet'} <Check size={17} aria-hidden="true" />
                </button>
              </form>
              <div className={styles.hint}>
                <Home size={18} />
                <span>Adreslerini kaydedersen sipariş verirken tek tıkla seçebilirsin.</span>
                <button
                  onClick={() => {
                    changeTab('addresses');
                  }}
                >
                  Adreslerime git
                </button>
              </div>
            </>
          )}
          {tab === 'addresses' && (
            <>
              <div className={styles.sectionTop}>
                <div>
                  <h2>Adres defterim</h2>
                  <p>Ev, iş veya farklı teslimat adreslerini kaydet.</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-expanded={!!addressForm}
                  className={styles.actionButton}
                  onClick={() => {
                    setEditingId(null);
                    setAddressForm({
                      ...blankAddress,
                      recipient_name: profile.full_name,
                      phone: profile.phone,
                    });
                    message();
                  }}
                >
                  <Plus size={17} /> Yeni adres
                </button>
              </div>
              {addressForm && (
                <div className={styles.addressEditor}>
                  <h3>{editingId ? 'Adresi düzenle' : 'Yeni adres ekle'}</h3>
                  <p className={styles.editorHint}>Teslimat sırasında kullanacağın adres bilgilerini doldur.</p>
                  <form onSubmit={saveAddress} className={styles.form}>
                  <div className={styles.formGrid}>
                    <label>
                      Adres başlığı
                      <input
                        required
                        maxLength={40}
                        ref={addressTitleRef}
                         value={addressForm.label}
                        onChange={(e) =>
                          setAddressForm((p) => p && { ...p, label: e.target.value })
                        }
                        placeholder="Ev / İş"
                      />
                    </label>
                    <label>
                      Alıcı adı soyadı
                      <input
                        required
                        minLength={3}
                        maxLength={100}
                        autoComplete="name"
                        value={addressForm.recipient_name}
                        onChange={(e) =>
                          setAddressForm((p) => p && { ...p, recipient_name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Telefon
                      <input
                        required
                        type="tel"
                        minLength={10}
                        maxLength={20}
                        value={addressForm.phone}
                        onChange={(e) =>
                          setAddressForm((p) => p && { ...p, phone: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      İl
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((p) => p && { ...p, city: e.target.value })}
                      />
                    </label>
                    <label>
                      İlçe
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        value={addressForm.district}
                        onChange={(e) =>
                          setAddressForm((p) => p && { ...p, district: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Açık adres
                    <textarea
                      required
                      minLength={10}
                      maxLength={500}
                      rows={3}
                      value={addressForm.address}
                      onChange={(e) =>
                        setAddressForm((p) => p && { ...p, address: e.target.value })
                      }
                    />
                  </label>
                  <div className={styles.actionRow}>
                    <button type="submit" className="button button-primary" disabled={busy}>
                      {busy ? 'Kaydediliyor...' : editingId ? 'Adres güncelle' : 'Adresi kaydet'}
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => {
                        setAddressForm(null);
                        setEditingId(null);
                      }}
                    >
                      Vazgeç
                    </button>
                  </div>
                  </form>
                </div>
              )}
              <div className={styles.addressList}>
                {addresses.length === 0 && !loadError && (
                  <div className={styles.empty}>
                    <MapPin size={28} />
                    <h3>Henüz kayıtlı adresin yok</h3>
                    <p>İlk adresini eklediğinde sipariş sırasında buradan seçebilirsin.</p>
                  </div>
                )}
                {addresses.map((address) => (
                  <article className={styles.addressCard} key={address.id}>
                    <div className={styles.addressHeading}>
                      <strong>
                        <MapPin size={17} />
                        {address.label}
                      </strong>
                      {address.is_default && (
                        <span className={styles.defaultBadge}>Varsayılan</span>
                      )}
                    </div>
                    <p>
                      <b>{address.recipient_name}</b> · {address.phone}
                    </p>
                    <p>
                      {address.address}, {address.district} / {address.city}
                    </p>
                    <div className={styles.cardActions}>
                      {!address.is_default && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDefault(address.id)}
                        >
                          <Check size={15} /> Varsayılan yap
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => editAddress(address)}>
                        <Pencil size={15} /> Düzenle
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteAddress(address.id)}
                      >
                        <Trash2 size={15} /> Sil
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === 'orders' && (
            <>
              <div className={styles.sectionTop}>
                <div>
                  <h2>Sipariş taleplerim</h2>
                  <p>Üye olarak verdiğin sipariş taleplerinin son 30 kaydı.</p>
                </div>
                <Package size={25} />
              </div>
              {initialOrders.length === 0 && !loadError && (
                <div className={styles.empty}>
                  <Package size={28} />
                  <h3>Henüz siparişin yok</h3>
                  <p>
                    Misafir olarak daha önce verdiğin siparişler güvenlik nedeniyle otomatik
                    bağlanmaz.
                  </p>
                  <Link href="/urunler" className="button button-primary">
                    Ürünleri incele <ArrowRight size={17} />
                  </Link>
                </div>
              )}
              <div className={styles.orderList}>
                {initialOrders.map((order, index) => (
                  <article className={styles.orderCard} key={order.id}>
                    <details className={styles.orderAccordion} open={index === 0}>
                      <summary className={styles.orderSummary}>
                        <span className={styles.orderHeading}>
                          <span>
                            <strong>#{order.reference}</strong>
                            <small>
                              {new Date(order.created_at).toLocaleDateString('tr-TR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </small>
                          </span>
                          <span className={styles.status} data-tone={orderStatusPresentation(order.status).tone}>
                            {orderStatusPresentation(order.status).label}
                          </span>
                        </span>
                        <span className={styles.orderSummaryEnd}>
                          <strong>{formatPrice(Number(order.total))}</strong>
                          <ChevronDown size={20} className={styles.orderChevron} aria-hidden="true" />
                        </span>
                      </summary>
                      <div className={styles.orderExpanded}>
                        <OrderJourney order={order} />
                        {order.order_request_items.some(item => item.product_id) && (
                          <div className={styles.repeatActions}>
                            <button type="button" className="button button-outline" onClick={() => repeatOrder(order)}>
                              <ShoppingBag size={16} /> Yeniden sepete ekle
                            </button>
                          </div>
                        )}
                        <div className={styles.orderItems}>
                          {order.order_request_items?.map((line, lineIndex) => (
                            <div key={`${order.id}-${lineIndex}`}>
                              <span>
                                {line.product_name}
                                {line.variant_label ? ` — ${line.variant_label}` : ''} × {line.quantity}
                              </span>
                              <b>{formatPrice(Number(line.line_total))}</b>
                            </div>
                          ))}
                        </div>
                        {Number(order.discount_amount) > 0 && (
                          <p className={styles.orderDiscount}>
                            {order.coupon_code
                              ? `Kupon (${order.coupon_code})`
                              : `Kampanya (${order.automatic_campaign_name})`}
                            : −{formatPrice(Number(order.discount_amount))}
                          </p>
                        )}
                        <div className={styles.orderFooter}>
                          <small className={styles.paymentDescription}>
                            {order.delivery_method === 'pickup' ? 'Mağazadan teslim' : 'Kargo'}
                            <span className={styles.paymentStatus} data-tone={paymentStatusPresentation(order.payment_status).tone}>
                              {paymentStatusPresentation(order.payment_status).label}
                            </span>
                          </small>
                          <strong>{formatPrice(Number(order.total))}</strong>
                        </div>
                        <p className={styles.invoiceNote}>
                          {order.order_invoice_register?.status === 'issued'
                            ? `Fatura kaydı: ${order.order_invoice_register.invoice_number ?? '—'} (${order.order_invoice_register.document_type === 'e_fatura' ? 'e-Fatura' : 'e-Arşiv'})`
                            : order.order_invoice_register?.status === 'pending'
                              ? 'Fatura: Resmî belge kaydı bekleniyor'
                              : 'Fatura: Bu sipariş için elektronik belge bilgisi kayıtlı değil'}
                        </p>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
