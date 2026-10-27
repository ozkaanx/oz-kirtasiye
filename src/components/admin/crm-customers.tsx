'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useClock } from '@/lib/use-clock';
import { ArrowLeft, ArrowRight, LogOut, Search, Users, TicketPercent } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format';
import styles from './crm-customers.module.css';
export type CrmCustomer = {userId:string;email:string;name:string;phone:string;registeredAt:string;orderCount:number;completedCount:number;requestedTotal:number;lastOrderAt:string|null};
type Segment = 'all'|'no-order'|'first'|'repeat'|'inactive';
const formatDate=(value:string|null)=>value?new Date(value).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short',year:'numeric'}):'—';
function segmentFor(c:CrmCustomer):Exclude<Segment,'all'> { if(!c.orderCount)return 'no-order'; if(c.orderCount>=2)return 'repeat';return 'first'; }
export function CrmCustomers({customers,error,capped}:{customers:CrmCustomer[];error:string|null;capped:boolean}) {
 const [search,setSearch]=useState('');const [segment,setSegment]=useState<Segment>('all');const router=useRouter();
 const now = useClock(); const inactive=(c:CrmCustomer)=>!!c.lastOrderAt && now-new Date(c.lastOrderAt).getTime()>90*86400000;
 const filtered=customers.filter(c=>{
  const q=search.trim().toLocaleLowerCase('tr-TR');
  return (!q||`${c.name} ${c.email} ${c.phone}`.toLocaleLowerCase('tr-TR').includes(q)) &&
   (segment==='all'|| (segment==='inactive'?inactive(c):segmentFor(c)===segment));
 });
 const segments:[Segment,string][]=[['all','Tüm üyeler'],['no-order','Siparişi olmayan'],['first','İlk sipariş'],['repeat','Tekrar alışveriş'],['inactive','90+ gün pasif']];
 async function logout(){await createBrowserSupabase().auth.signOut();router.replace('/admin/giris');router.refresh();}
 return <div className="admin-shell"><AdminSidebar/><main className="admin-main"><div className="admin-top"><Link href="/"><ArrowLeft size={16}/> Mağazaya dön</Link><button className="admin-logout" onClick={()=>void logout()}><LogOut size={16}/> Çıkış yap</button></div><div className="admin-body">
  <header className="admin-page-heading"><div><span className="section-eyebrow">ÖZ KIRTASİYE · CRM</span><h1>Müşteriler<span className="orange-dot">.</span></h1><p>Üye profilleri, sipariş talepleri ve tekrar alışveriş segmentleri.</p></div></header>
  <div className={styles.stats}><div><span>Kayıtlı üyeler</span><strong>{customers.length}</strong></div><div><span>Sipariş verenler</span><strong>{customers.filter(c=>c.orderCount>0).length}</strong></div><div><span>Tekrar alışveriş</span><strong>{customers.filter(c=>c.orderCount>=2).length}</strong></div><div><span>Siparişi olmayan</span><strong>{customers.filter(c=>c.orderCount===0).length}</strong></div></div>
  {error&&<p className="admin-form-error" role="alert">Müşteriler yüklenemedi: {error}</p>}
  {capped&&<p role="note" className={styles.notice}>Güvenli sorgu limiti 5.000 üyedir. Daha fazla kayıt için sayfalama gerekir.</p>}
  <p className={styles.notice}>Tutarlar tahsilat değil, iptal edilmemiş sipariş taleplerinin nominal toplamıdır. Pasif müşteri = son siparişi 90 günden eski olan üye.</p>
  <section className={styles.panel}><div className={styles.filters}><label className={styles.search}><Search size={17}/><input aria-label="Müşteri ara" placeholder="Ad, e-posta veya telefon ara" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Müşteri segmenti" value={segment} onChange={e=>setSegment(e.target.value as Segment)}>{segments.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
   <p className={styles.result}>{filtered.length} müşteri gösteriliyor.</p>
   {filtered.length===0&&<p className={styles.empty}>Bu filtreyle eşleşen müşteri yok.</p>}
   <div className={styles.list}>{filtered.map(c=><div key={c.userId} className={styles.customer}>
    <Link className={styles.details} href={`/admin/musteriler/${c.userId}`}><span className={styles.avatar}><Users size={19}/></span><span className={styles.identity}><strong>{c.name||'İsimsiz üye'}</strong><small>{c.email||c.phone||'İletişim bilgisi yok'}</small><small>Üyelik: {formatDate(c.registeredAt)} · Son sipariş: {formatDate(c.lastOrderAt)}</small></span><span className={styles.numbers}><strong>{c.orderCount} talep</strong><small>{formatPrice(c.requestedTotal)}</small><small>{c.orderCount===0?'Yeni üye':c.orderCount>=2?'Tekrar müşteri':'İlk sipariş'}</small></span><ArrowRight size={18}/></Link>
    <Link className={styles.coupon} href={`/admin/kupon-atamalari?customer=${encodeURIComponent(c.userId)}`} title="Müşteriye kupon ata"><TicketPercent size={17}/> Kupon ata</Link>
   </div>)}</div>
  </section>
 </div></main></div>;
}
