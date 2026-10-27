'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/browser';
type Coupon={id:string;code:string;label:string;is_active:boolean};
type Assignment={coupon_id:string;user_id:string};
type Customer={id:string;name:string;email:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function CouponAssignments({coupons,assignments,initialUser='',customers=[]}:{coupons:Coupon[];assignments:Assignment[];initialUser?:string;customers?:Customer[]}) {
 const router=useRouter(); const [coupon,setCoupon]=useState(coupons[0]?.id??''); const [user,setUser]=useState(initialUser); const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [previousUser,setPreviousUser]=useState(initialUser);
 if(initialUser!==previousUser){setPreviousUser(initialUser);setUser(initialUser);}
 const selected=assignments.find(a=>a.coupon_id===coupon);
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!coupon||!uuid.test(user)||!customers.some(c=>c.id===user)){setMessage('Listeden geçerli bir müşteri seçin.');return;}setBusy(true);setMessage('');
  const {error}=await createBrowserSupabase().from('coupon_private_assignments').upsert({coupon_id:coupon,user_id:user},{onConflict:'coupon_id'});setBusy(false);setMessage(error?error.message:'Atama kaydedildi.');if(!error)router.refresh(); }
 async function remove(){if(!selected||busy||!window.confirm('Atama kaldırılınca kupon genel kurallara döner. Devam?'))return;setBusy(true);const {error}=await createBrowserSupabase().from('coupon_private_assignments').delete().eq('coupon_id',coupon);setBusy(false);setMessage(error?error.message:'Atama kaldırıldı; kupon genel kullanım kurallarına döndü.');if(!error)router.refresh();}
 return <section style={{background:'#fff',border:'1px solid #e1e4eb',borderRadius:16,padding:24,marginTop:25}}><form onSubmit={save} style={{display:'grid',gap:18}}>
  <label style={{display:'grid',gap:8}}>Kupon<select value={coupon} onChange={e=>setCoupon(e.target.value)} required style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>{coupons.map(c=><option key={c.id} value={c.id}>{c.code} — {c.label}{!c.is_active?' (pasif)':''}</option>)}</select></label>
  <p style={{margin:0,fontSize:13}}>Mevcut atama: <strong>{customers.find(c=>c.id===selected?.user_id)?.name??selected?.user_id??'Yok (genel kupon)'}</strong></p>
  <label style={{display:'grid',gap:8}}>Müşteri seç<select value={user} onChange={e=>setUser(e.target.value)} required style={{padding:12,border:'1px solid #ddd',borderRadius:8}}><option value="">Müşteri seçin</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}</select></label>
  <small style={{color:'#68727e'}}>Müşteri değiştirilirse önceki müşterinin kupon hakkı kaldırılır.</small>
  <div style={{display:'flex',flexWrap:'wrap',gap:12}}><button type="submit" className="button button-primary" disabled={busy||!coupons.length}>Atamayı kaydet</button><button type="button" className="button button-outline" disabled={busy||!selected} onClick={()=>void remove()}>Atamayı kaldır</button><Link href="/admin/kuponlar" className="button button-outline">Kuponlara dön</Link></div>{message&&<p role="status">{message}</p>}
 </form></section>;
}
