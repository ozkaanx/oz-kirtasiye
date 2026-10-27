'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { BadgePercent, ArrowRight } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { normalizeCouponCode } from '@/lib/coupon';

export function LoyaltyCouponEntry() {
  const { couponCode, setCouponCode } = useShop();
  const [draft, setDraft] = useState(couponCode);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeCouponCode(draft);
    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
      setSuccess('');
      setError('Kupon kodu 4–32 karakter olmalı; harf, rakam, _ veya - içerebilir.');
      return;
    }
    setCouponCode(code);
    setDraft(code);
    setError('');
    setSuccess('Kupon sepetine kaydedildi. Geçerliliği sepet toplamına göre kontrol edilecek.');
  }

  return (
    <section style={{ background: 'white', border: '1px solid #e6e8ef', padding: 24, borderRadius: 16 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 23, marginTop: 0 }}>
        <BadgePercent size={23} color="#ed643f" /> Kuponumu kullan
      </h2>
      <p style={{ color: '#697480', fontSize: 14, lineHeight: 1.6 }}>Mağazanın sana verdiği kupon kodunu gir. Geçerli indirim sepet ekranında hesaplanır.</p>
      <form onSubmit={apply} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
        <input aria-label="Kupon kodu" value={draft} onChange={e => setDraft(e.target.value)} maxLength={32} autoCapitalize="characters" placeholder="Kupon kodu" style={{ flex: '1 1 220px', minWidth: 0, border: '1px solid #d9dfe7', borderRadius: 10, padding: '13px 14px', fontSize: 15 }} />
        <button type="submit" className="button button-primary">Sepete kaydet</button>
      </form>
      {error && <p role="alert" style={{ color: '#b32920', fontSize: 13 }}>{error}</p>}
      {success && <p role="status" style={{ color: '#23734a', fontSize: 13 }}>{success}</p>}
      {couponCode && <p style={{ fontSize: 13 }}>Sepetteki kod: <strong>{couponCode}</strong>{' '}<button type="button" onClick={() => { setCouponCode(''); setDraft(''); setSuccess('Kupon kaldırıldı.'); }} style={{ marginLeft: 10, border: 'none', background: 'none', color: '#d04c2d', textDecoration: 'underline', cursor: 'pointer' }}>Kaldır</button></p>}
      <Link className="button button-outline" href="/sepet" style={{ display: 'inline-flex', marginTop: 16, gap: 8 }}>Sepetime git <ArrowRight size={16} /></Link>
    </section>
  );
}
