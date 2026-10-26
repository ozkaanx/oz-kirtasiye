'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import styles from './product-reviews.module.css';
type Review = {id:string; rating:number; body:string; created_at:string};
export function ProductReviews({productId,reviews,average}:{productId:string;reviews:Review[];average:number}) {
 const [rating,setRating]=useState(5); const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice('');
  const db=createBrowserSupabase();const {data:{user}}=await db.auth.getUser();
  if(!user){setNotice('Değerlendirme için giriş yapmalısınız.');setBusy(false);return;}
  const {error}=await db.rpc('submit_product_review',{p_product_id:productId,p_rating:rating,p_body:body});
  setNotice(error?error.message:'Yorumunuz incelemeye gönderildi.');if(!error)setBody('');setBusy(false);
 }
 return <section className={styles.section} aria-labelledby="reviews-heading"><div className={styles.heading}><h2 id="reviews-heading">Müşteri değerlendirmeleri</h2><span>{reviews.length} yorum{reviews.length>0?` · ${average.toFixed(1)} / 5`:''}</span></div>
 {reviews.length? <div className={styles.entries}>{reviews.map(r=><article key={r.id} className={styles.review}><strong aria-label={`${r.rating} / 5 yıldız`}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</strong><p>{r.body}</p><small>{new Date(r.created_at).toLocaleDateString('tr-TR')}</small></article>)}</div>:<p>Henüz onaylanmış değerlendirme yok.</p>}
 <form onSubmit={submit} className={styles.form}><h3>Ürünü değerlendir</h3><p>Yalnızca teslim edilmiş veya tamamlanmış siparişlerinde bulunan ürünleri değerlendirebilirsin. Yorumlar onaylandıktan sonra yayımlanır.</p><label htmlFor="review-rating">Puan</label><select id="review-rating" value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} yıldız</option>)}</select><label htmlFor="review-body">Yorum</label><textarea id="review-body" minLength={10} maxLength={1000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Ürün hakkındaki deneyimini paylaş..."/><button disabled={busy} type="submit">{busy?'Gönderiliyor...':'Yorumu gönder'}</button><Link href="/giris">Hesabına giriş yap</Link>{notice&&<p role="status">{notice}</p>}</form></section>;
}
