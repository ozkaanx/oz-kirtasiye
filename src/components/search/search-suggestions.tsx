'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3, Search, Package, ArrowUpRight } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import styles from './search-suggestions.module.css';

type Suggestion = { id: string; name: string; slug: string; price: number | null; imageUrl: string | null };
const RECENT_KEY = 'oz-kirtasiye-recent-searches';
const SUGGESTED = ['Defter', 'Kalem', 'Oyuncak'];

export function saveRecentSearch(raw: string) {
  const q = raw.trim().slice(0, 70);
  if (!q || typeof window === 'undefined') return;
  try {
    const previous = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as unknown;
    const list = Array.isArray(previous) ? previous.filter((item): item is string => typeof item === 'string') : [];
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...list.filter((item) => item.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'))].slice(0, 5)));
  } catch { /* Storage may be disabled. */ }
}

export function SearchSuggestions({ query, onChoose }: { query: string; onChoose: () => void }) {
  const focused = true;
  const [products, setProducts] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const q = query.trim();

  useEffect(() => {
    if (!focused) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      setRecent(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(0, 5) : []);
    } catch { setRecent([]); }
  }, [focused]);

  useEffect(() => {
    if (!focused || q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Öneriler yüklenemedi');
        const data = (await response.json()) as { products?: Suggestion[] };
        if (!controller.signal.aborted) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch { if (!controller.signal.aborted) setProducts([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [focused, q]);

  if (!focused) return null;
  const terms = q ? [] : (recent.length ? recent : SUGGESTED);
  return (
    <div className={styles.overlay} onMouseDown={(event) => event.preventDefault()}>
      <button type="button" className={styles.close} onClick={onChoose} aria-label="Arama önerilerini kapat">Kapat</button>
      {q.length >= 2 ? (
        <>
          <div className={styles.heading}>{loading ? 'Ürünler aranıyor…' : 'Ürün önerileri'}</div>
          {!loading && products.length === 0 && <p className={styles.message}>Eşleşen ürün bulunamadı. Tüm sonuçlara göz atabilirsin.</p>}
          {products.map((product) => (
            <Link key={product.id} className={styles.item} href={`/magaza/urun/${encodeURIComponent(product.slug)}`} onClick={() => { saveRecentSearch(q); onChoose(); }}>
              <div className={styles.picture}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Package size={19}/>}</div>
              <span className={styles.itemName}>{product.name}<small>{product.price === null ? 'Seçenekleri görüntüle' : formatPrice(product.price)}</small></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
          <Link className={styles.all} href={`/urunler?q=${encodeURIComponent(q)}`} onClick={() => { saveRecentSearch(q); onChoose(); }}><Search size={15}/> Tüm arama sonuçlarını göster</Link>
        </>
      ) : (
        <>
          <div className={styles.heading}>{recent.length ? 'Son aramalarım' : 'Önerilen aramalar'}</div>
          {terms.map((term) => <Link className={styles.term} key={term} href={`/urunler?q=${encodeURIComponent(term)}`} onClick={() => { saveRecentSearch(term); onChoose(); }}><Clock3 size={15}/>{term}</Link>)}
        </>
      )}
    </div>
  );
}

