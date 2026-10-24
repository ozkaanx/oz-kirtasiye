'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Check, Home, LogOut, MapPin, Package, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { formatPrice } from '@/lib/format';
import type { CustomerAddress, CustomerOrder, CustomerProfile } from '@/lib/customer';
import styles from './customer-account.module.css';

type AddressFields = Pick<CustomerAddress,'label' | 'recipient_name' | 'phone' | 'city' | 'district' | 'address'>;
const blankAddress: AddressFields = { label:'Ev', recipient_name:'', phone:'', city:'İstanbul', district:'', address:'' };

type Props = {
  userId: string;
  email: string;
  initialProfile: CustomerProfile;
  initialAddresses: CustomerAddress[];
  initialOrders: CustomerOrder[];
  loadError?: string;
};

const statusLabels: Record<string,string> = {
  new: 'Yeni talep', contacted: 'Görüşüldü', processing: 'Hazırlanıyor', shipped: 'Kargoda',
  delivered: 'Teslim edildi', completed:'Tamamlandı', cancelled:'İptal edildi',
};

export function CustomerAccount({userId,email,initialProfile,initialAddresses,initialOrders,loadError}:Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const [tab,setTab] = useState<'overview'|'addresses'|'orders'>('overview');
  const [profile,setProfile] = useState({full_name: initialProfile.full_name,phone: initialProfile.phone ?? ''});
  const [addresses,setAddresses] = useState<CustomerAddress[]>(initialAddresses);
  const [editingId,setEditingId] = useState<string | null>(null);
  const [addressForm,setAddressForm] = useState<AddressFields | null>(null);
  const [error,setError] = useState(loadError ?? '');
  const [success,setSuccess] = useState('');
  const [busy,setBusy] = useState(false);

  function message(errorText?:string,successText?:string) {
    setError(errorText ?? '');
    setSuccess(successText ?? '');
  }

  async function saveProfile(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); message();
    try {
      const { error:saveError } = await supabase.from('customer_profiles').upsert({
        user_id:userId,full_name:profile.full_name.trim(),phone:profile.phone.trim() || null,
      },{ onConflict:'user_id' });
      if (saveError) throw new Error(saveError.message);
      message(undefined,'Profil bilgilerin kaydedildi.');
    } catch (cause) { message(cause instanceof Error ? cause.message : 'Profil kaydedilemedi.'); }
    finally { setBusy(false); }
  }

  async function reloadAddresses() {
    const { data, error:readError } = await supabase.from('customer_addresses')
      .select('id,user_id,label,recipient_name,phone,city,district,address,is_default,created_at')
      .order('is_default',{ascending:false}).order('created_at',{ascending:false});
    if (readError) throw new Error(readError.message);
    setAddresses((data ?? []) as CustomerAddress[]);
  }

  function editAddress(address:CustomerAddress) {
    setEditingId(address.id);
    setAddressForm({label:address.label,recipient_name:address.recipient_name,phone:address.phone,
      city:address.city,district:address.district,address:address.address});
    message();
  }

  async function saveAddress(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressForm || busy) return;
    setBusy(true);message();
    try {
      const payload={...addressForm,label:addressForm.label.trim(),recipient_name:addressForm.recipient_name.trim(),
        phone:addressForm.phone.trim(),city:addressForm.city.trim(),district:addressForm.district.trim(),address:addressForm.address.trim()};
      const { error:saveError } = editingId
        ? await supabase.from('customer_addresses').update(payload).eq('id',editingId).eq('user_id',userId)
        : await supabase.from('customer_addresses').insert({...payload,user_id:userId,is_default:false});
      if (saveError) throw new Error(saveError.message);
      await reloadAddresses();
      setAddressForm(null);setEditingId(null);
      message(undefined,'Adres kaydedildi.');
    } catch(cause) { message(cause instanceof Error ? cause.message : 'Adres kaydedilemedi.'); }
    finally {setBusy(false);}
  }

  async function setDefault(id:string) {
    if (busy) return;
    setBusy(true);message();
    try {
      const {error:rpcError}=await supabase.rpc('set_default_customer_address',{p_address_id:id});
      if (rpcError) throw new Error(rpcError.message);
      await reloadAddresses();message(undefined,'Varsayılan adres güncellendi.');
    }catch(cause){message(cause instanceof Error ? cause.message : 'Adres güncellenemedi.');}
    finally {setBusy(false);}
  }

  async function deleteAddress(id:string) {
    if (busy || !window.confirm('Bu adresi silmek istiyor musun?')) return;
    setBusy(true);message();
    try {
      const {error:deleteError}=await supabase.from('customer_addresses').delete().eq('id',id).eq('user_id',userId);
      if (deleteError) throw new Error(deleteError.message);
      await reloadAddresses();message(undefined,'Adres silindi.');
    }catch(cause){message(cause instanceof Error ? cause.message : 'Adres silinemedi.');}
    finally {setBusy(false);}
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    const {error:logoutError}=await supabase.auth.signOut();
    if (logoutError) { message(logoutError.message);setBusy(false);return; }
    router.replace('/giris');router.refresh();
  }

  return (
    <section className={`container-wide ${styles.page}`}>
      <div className={styles.pageHeader}>
        <div><span className="section-eyebrow">ÖZ KIRTASİYE / HESABIM</span><h1>Merhaba{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}<span className="orange-dot">.</span></h1><p>Hesap bilgilerin, adreslerin ve sipariş taleplerin tek bir yerde.</p></div>
        <button type="button" className={styles.logout} onClick={logout} disabled={busy}><LogOut size={16}/> Çıkış yap</button>
      </div>
      <div className={styles.shell}>
        <nav className={styles.tabs} aria-label="Hesap menüsü">
          {([{id:'overview',label:'Profilim',icon:UserRound},{id:'addresses',label:'Adreslerim',icon:MapPin},{id:'orders',label:'Siparişlerim',icon:Package}] as const).map(({id,label,icon:Icon}) => (
            <button type="button" key={id} className={`${styles.tab} ${tab===id?styles.active:''}`} onClick={()=>{setTab(id);message();}}><Icon size={18}/>{label}</button>
          ))}
          <Link href="/urunler" className={styles.shopLink}>Alışverişe dön <ArrowRight size={16}/></Link>
        </nav>
        <div className={styles.panel}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {success && <p role="status" className={styles.success}>{success}</p>}
          {tab==='overview' && <>
            <div className={styles.sectionTop}><div><h2>Kişisel bilgilerim</h2><p>İletişim bilgilerini buradan güncelleyebilirsin.</p></div><UserRound size={25}/></div>
            <form onSubmit={saveProfile} className={styles.form}>
              <label>E-posta<input disabled value={email} type="email" /><small>E-posta değişikliği bu ekrandan yapılmıyor.</small></label>
              <label>Ad soyad<input required minLength={3} maxLength={100} autoComplete="name" value={profile.full_name} onChange={(e)=>setProfile(p=>({...p,full_name:e.target.value}))}/></label>
              <label>Telefon<input type="tel" minLength={10} maxLength={20} autoComplete="tel" value={profile.phone} onChange={(e)=>setProfile(p=>({...p,phone:e.target.value}))}/></label>
              <button type="submit" className="button button-primary" disabled={busy}>Bilgileri kaydet <Check size={17}/></button>
            </form>
            <div className={styles.hint}><Home size={18}/><span>Adreslerini kaydedersen sipariş verirken tek tıkla seçebilirsin.</span><button onClick={()=>{setTab('addresses');message();}}>Adreslerime git</button></div>
          </>}
          {tab==='addresses' && <>
            <div className={styles.sectionTop}><div><h2>Adres defterim</h2><p>Ev, iş veya farklı teslimat adreslerini kaydet.</p></div><button className={styles.actionButton} onClick={()=>{setEditingId(null);setAddressForm({...blankAddress,recipient_name:profile.full_name,phone:profile.phone});message();}}><Plus size={17}/> Yeni adres</button></div>
            {addressForm && <form onSubmit={saveAddress} className={styles.form}>
              <div className={styles.formGrid}>
                <label>Adres başlığı<input required maxLength={40} value={addressForm.label} onChange={e=>setAddressForm(p=>p&&({...p,label:e.target.value}))} placeholder="Ev / İş" /></label>
                <label>Alıcı adı soyadı<input required minLength={3} maxLength={100} autoComplete="name" value={addressForm.recipient_name} onChange={e=>setAddressForm(p=>p&&({...p,recipient_name:e.target.value}))}/></label>
                <label>Telefon<input required type="tel" minLength={10} maxLength={20} value={addressForm.phone} onChange={e=>setAddressForm(p=>p&&({...p,phone:e.target.value}))}/></label>
                <label>İl<input required minLength={2} maxLength={80} value={addressForm.city} onChange={e=>setAddressForm(p=>p&&({...p,city:e.target.value}))}/></label>
                <label>İlçe<input required minLength={2} maxLength={80} value={addressForm.district} onChange={e=>setAddressForm(p=>p&&({...p,district:e.target.value}))}/></label>
              </div>
              <label>Açık adres<textarea required minLength={10} maxLength={500} rows={3} value={addressForm.address} onChange={e=>setAddressForm(p=>p&&({...p,address:e.target.value}))} /></label>
              <div className={styles.actionRow}><button type="submit" className="button button-primary" disabled={busy}>{editingId?'Adres güncelle':'Adresi kaydet'}</button><button type="button" className="button button-outline" onClick={()=>{setAddressForm(null);setEditingId(null);}}>Vazgeç</button></div>
            </form>}
            <div className={styles.addressList}>
              {addresses.length===0 && <div className={styles.empty}><MapPin size={28}/><h3>Henüz kayıtlı adresin yok</h3><p>İlk adresini eklediğinde sipariş sırasında buradan seçebilirsin.</p></div>}
              {addresses.map(address=><article className={styles.addressCard} key={address.id}>
                <div className={styles.addressHeading}><strong><MapPin size={17}/>{address.label}</strong>{address.is_default&&<span className={styles.defaultBadge}>Varsayılan</span>}</div>
                <p><b>{address.recipient_name}</b> · {address.phone}</p>
                <p>{address.address}, {address.district} / {address.city}</p>
                <div className={styles.cardActions}>
                  {!address.is_default&&<button type="button" disabled={busy} onClick={()=>setDefault(address.id)}><Check size={15}/> Varsayılan yap</button>}
                  <button type="button" disabled={busy} onClick={()=>editAddress(address)}><Pencil size={15}/> Düzenle</button>
                  <button type="button" disabled={busy} onClick={()=>deleteAddress(address.id)}><Trash2 size={15}/> Sil</button>
                </div>
              </article>)}
            </div>
          </>}
          {tab==='orders' && <>
            <div className={styles.sectionTop}><div><h2>Sipariş taleplerim</h2><p>Üye olarak verdiğin sipariş taleplerinin son 30 kaydı.</p></div><Package size={25}/></div>
            {initialOrders.length===0 && <div className={styles.empty}><Package size={28}/><h3>Henüz siparişin yok</h3><p>Misafir olarak daha önce verdiğin siparişler güvenlik nedeniyle otomatik bağlanmaz.</p><Link href="/urunler" className="button button-primary">Ürünleri incele <ArrowRight size={17}/></Link></div>}
            <div className={styles.orderList}>{initialOrders.map(order=><article className={styles.orderCard} key={order.id}>
              <div className={styles.orderHeading}><div><strong>#{order.reference}</strong><small>{new Date(order.created_at).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})}</small></div><span className={styles.status}>{statusLabels[order.status]??order.status}</span></div>
              <div className={styles.orderItems}>{order.order_request_items?.map((line,index)=><div key={`${order.id}-${index}`}><span>{line.product_name}{line.variant_label ? ` — ${line.variant_label}` : ""} × {line.quantity}</span><b>{formatPrice(Number(line.line_total))}</b></div>)}</div>
              {Number(order.discount_amount)>0 && <p style={{fontSize:12,color:'#217447',marginTop:10}}>Kupon indirimi ({order.coupon_code}): −{formatPrice(Number(order.discount_amount))}</p>}
              <div className={styles.orderFooter}><small>{order.delivery_method==='pickup'?'Mağazadan teslim':'Kargo'} · {order.payment_status==='not_collected'?'Ödeme alınmadı':'Ödeme durumunu mağazadan doğrulayın'}</small><strong>{formatPrice(Number(order.total))}</strong></div>
              <p style={{fontSize:12,color:'#68727e',marginTop:9}}>
                {order.order_invoice_register?.status==='issued'
                  ? `Fatura kaydı: ${order.order_invoice_register.invoice_number ?? '—'} (${order.order_invoice_register.document_type==='e_fatura'?'e-Fatura':'e-Arşiv'})`
                  : order.order_invoice_register?.status==='pending'
                    ? 'Fatura: Resmî belge kaydı bekleniyor'
                    : 'Fatura: Bu sipariş için elektronik belge bilgisi kayıtlı değil'}
              </p>
            </article>)}</div>
          </>}
        </div>
      </div>
    </section>
  );
}
