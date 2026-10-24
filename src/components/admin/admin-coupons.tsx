'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgePercent, LogOut, PlusCircle, ShieldCheck } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { normalizeCouponCode } from '@/lib/coupon';
import { formatPrice } from '@/lib/format';
import styles from './admin-coupons.module.css';

export type AdminCoupon = {
  id:string;
  code:string;
  label:string;
  discount_type:'percent'|'fixed';
  discount_value:number;
  max_discount:number|null;
  min_subtotal:number;
  starts_at:string;
  expires_at:string|null;
  max_uses:number|null;
  max_uses_per_customer:number;
  is_active:boolean;
  used_count:number;
};

function fmtDate(date:string|null){
  return date ? new Date(date).toLocaleString('tr-TR',{
    timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'
  }) : 'Süresiz';
}

export function AdminCoupons({coupons,loadError}:{coupons:AdminCoupon[];loadError:string|null}){
  const router=useRouter();
  const [code,setCode]=useState('');
  const [label,setLabel]=useState('');
  const [type,setType]=useState<'percent'|'fixed'>('percent');
  const [value,setValue]=useState('10');
  const [cap,setCap]=useState('');
  const [minimum,setMinimum]=useState('0');
  const [maxUses,setMaxUses]=useState('');
  const [personLimit,setPersonLimit]=useState('1');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [search,setSearch]=useState('');

  const filtered=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase('tr-TR');
    return coupons.filter(c=>`${c.code} ${c.label}`.toLocaleLowerCase('tr-TR').includes(q));
  },[coupons,search]);

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy) return;
    setError('');setSuccess('');
    const normalized=normalizeCouponCode(code);
    if(!/^[A-Z0-9_-]{4,32}$/.test(normalized)){
      setError('Kod 4-32 karakter olmalı; harf, sayı, _ veya - kullanılabilir.');return;
    }
    const numericValue=Number(value);
    if(!Number.isFinite(numericValue)||numericValue<=0||(type==='percent'&&numericValue>100)){
      setError('İndirim değeri geçersiz.');return;
    }
    if(end && start && new Date(end)<=new Date(start)){
      setError('Bitiş tarihi başlangıçtan sonra olmalı.');return;
    }
    setBusy(true);
    try {
      const {data:auth}=await createBrowserSupabase().auth.getUser();
      const payload={
        code:normalized,label:label.trim(),discount_type:type,discount_value:numericValue,
        max_discount:type==='percent'&&cap!==''?Number(cap):null,
        min_subtotal:Number(minimum),
        max_uses:maxUses===''?null:Number(maxUses),
        max_uses_per_customer:Number(personLimit),
        starts_at:start?new Date(start).toISOString():new Date().toISOString(),
        expires_at:end?new Date(end).toISOString():null,
        created_by:auth.user?.id??null,
      };
      const {error:dbError}=await createBrowserSupabase().from('coupons').insert(payload);
      if(dbError) throw dbError;
      setSuccess(`${normalized} oluşturuldu. Kullanım hakkı yalnızca başarılı sipariş talebi kaydında düşer.`);
      setCode('');setLabel('');router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:'Kupon oluşturulamadı.');}
    finally{setBusy(false);}
  }

  async function toggle(coupon:AdminCoupon){
    if(busy) return;
    setError('');setSuccess('');setBusy(true);
    try{
      const {error:dbError}=await createBrowserSupabase().from('coupons')
        .update({is_active:!coupon.is_active}).eq('id',coupon.id);
      if(dbError) throw dbError;
      setSuccess(`${coupon.code}: ${coupon.is_active?'Kupon durduruldu.':'Kupon yeniden etkinleştirildi.'}`);
      router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:'Kupon durumu güncellenemedi.');}
    finally{setBusy(false);}
  }

  async function logout(){
    await createBrowserSupabase().auth.signOut();router.replace('/admin/giris');router.refresh();
  }

  return <div className="admin-shell">
    <AdminSidebar/>
    <main className="admin-main">
      <header className="admin-top">
        <Link href="/"><ArrowLeft size={16}/> Mağazaya dön</Link>
        <button type="button" className="admin-logout" onClick={()=>void logout()}><LogOut size={16}/> Çıkış yap</button>
      </header>
      <div className="admin-body">
        <div className="admin-page-heading"><div>
          <span className="section-eyebrow">ÖZ KIRTASİYE · KAMPANYALAR</span>
          <h1>İndirim kuponları<span className="orange-dot">.</span></h1>
          <p>Kupon oluştur, kullanım limitlerini belirle ve gerektiğinde tek tuşla durdur.</p>
        </div></div>
        <div className={styles.notice}><ShieldCheck size={19}/><span>
          <strong>Tahsilat yapılmaz.</strong> Buradaki kullanım adedi ödeme alınmamış ancak iptal edilmemiş sipariş taleplerini içerir. İptal edilen talepler kullanım hakkını geri bırakır.
        </span></div>
        {loadError && <p className={styles.error} role="alert">Kuponlar yüklenemedi: {loadError}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && <p className={styles.success} role="status">{success}</p>}
        <div className={styles.layout}>
          <section className={styles.panel}>
            <h2><PlusCircle size={19}/> Yeni kupon</h2>
            <form onSubmit={event=>void create(event)} className={styles.form}>
              <label>Kupon kodu<input required minLength={4} maxLength={32} placeholder="OZKIRTASIYE10" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label>
              <label>Açıklama<input required minLength={3} maxLength={100} placeholder="Yeni müşteri indirimi" value={label} onChange={e=>setLabel(e.target.value)}/></label>
              <div className={styles.two}>
                <label>İndirim türü
                  <select value={type} onChange={e=>setType(e.target.value as typeof type)}>
                    <option value="percent">Yüzde (%)</option><option value="fixed">Sabit tutar (TL)</option>
                  </select>
                </label>
                <label>Değer<input required min="0.01" max={type==='percent'?100:999999.99} step="0.01" type="number" value={value} onChange={e=>setValue(e.target.value)}/></label>
              </div>
              <div className={styles.two}>
                <label>Min. ürün tutarı (TL)<input required min="0" step="0.01" type="number" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
                <label>Maks. indirim (TL){type==='fixed'&&<small>Sabit TL için kullanılmaz</small>}
                  <input disabled={type==='fixed'} placeholder="Sınırsız" min="0.01" step="0.01" type="number" value={cap} onChange={e=>setCap(e.target.value)}/>
                </label>
              </div>
              <div className={styles.two}>
                <label>Toplam kullanım sınırı<input type="number" min="1" max="100000" placeholder="Sınırsız" value={maxUses} onChange={e=>setMaxUses(e.target.value)}/></label>
                <label>Müşteri başına kullanım<input required type="number" min="1" max="20" value={personLimit} onChange={e=>setPersonLimit(e.target.value)}/></label>
              </div>
              <div className={styles.two}>
                <label>Başlangıç (boşsa hemen)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
                <label>Bitiş (boşsa süresiz)<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
              </div>
              <button disabled={busy} type="submit" className={styles.primary}>{busy?'Kaydediliyor...':'Kupon oluştur'}</button>
            </form>
          </section>
          <section className={styles.panel}>
            <div className={styles.heading}><h2><BadgePercent size={19}/> Kupon listesi</h2><strong>{coupons.length} kupon</strong></div>
            <input className={styles.search} aria-label="Kupon ara" placeholder="Kod veya açıklama ara" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className={styles.stack}>{!filtered.length&&<p className={styles.empty}>Henüz kupon bulunamadı.</p>}
              {filtered.map(c=>{
                const expired=!!c.expires_at&&new Date(c.expires_at).getTime()<=Date.now();
                const upcoming=new Date(c.starts_at).getTime()>Date.now();
                const usedUp=c.max_uses!==null&&c.used_count>=c.max_uses;
                return <article key={c.id} className={styles.card}>
                  <div className={styles.cardTop}><strong>{c.code}</strong><span data-active={c.is_active&&!expired&&!usedUp&&!upcoming} className={styles.tag}>{!c.is_active?'Durduruldu':expired?'Süresi doldu':usedUp?'Limit doldu':upcoming?'Başlayacak':'Aktif'}</span></div>
                  <p>{c.label}</p>
                  <div className={styles.grid}>
                    <span>İndirim<strong>{c.discount_type==='percent'?`%${c.discount_value}`:formatPrice(c.discount_value)}</strong></span>
                    <span>Minimum sepet<strong>{formatPrice(c.min_subtotal)}</strong></span>
                    <span>Kullanım<strong>{c.used_count} / {c.max_uses??'∞'}</strong></span>
                    <span>Kişi limiti<strong>{c.max_uses_per_customer}</strong></span>
                    <span>Başlangıç<strong>{fmtDate(c.starts_at)}</strong></span>
                    <span>Bitiş<strong>{fmtDate(c.expires_at)}</strong></span>
                  </div>
                  <button className={styles.toggle} disabled={busy} onClick={()=>void toggle(c)} type="button">{c.is_active?'Kuponu durdur':'Yeniden etkinleştir'}</button>
                </article>;
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>;
}
