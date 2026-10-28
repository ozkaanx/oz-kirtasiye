'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { BadgePercent, ArrowRight } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import { normalizeCouponCode } from '@/lib/coupon';
import styles from './customer-coupons.module.css';

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
    <section className={styles.entry}>
      <h2><BadgePercent size={23} aria-hidden="true" /> Kupon kodumu kullan</h2>
      <p className={styles.description}>
        Mağazanın sana verdiği kupon kodunu gir. Geçerli indirim sepet ekranında hesaplanır.
      </p>
      <form onSubmit={apply} className={styles.form}>
        <input
          aria-label="Kupon kodu"
          aria-invalid={!!error}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={32}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Kupon kodu"
        />
        <button type="submit" className="button button-primary">Sepete kaydet</button>
      </form>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {success && <p role="status" className={styles.success}>{success}</p>}
      {couponCode && (
        <p className={styles.current}>
          Sepetteki kod: <strong>{couponCode}</strong>
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              setCouponCode('');
              setDraft('');
              setSuccess('Kupon kaldırıldı.');
              setError('');
            }}
          >
            Kaldır
          </button>
        </p>
      )}
      <Link className={`button button-outline ${styles.entryCart}`} href="/sepet">
        Sepetime git <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
