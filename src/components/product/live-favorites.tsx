'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import type { LiveProduct } from '@/lib/real-catalog';
import { LiveProductCard } from './live-product-card';

type FavoriteResult = {
  key: string;
  products: LiveProduct[];
  error: string | null;
};

export function LiveFavorites() {
  const { favorites, favoritesReady } = useShop();
  const [result, setResult] = useState<FavoriteResult | null>(null);
  const [retry, setRetry] = useState(0);
  const key = favorites.join(',');

  useEffect(() => {
    if (!favoritesReady || !favorites.length) return;

    const controller = new AbortController();
    async function loadFavorites() {
      try {
        const response = await fetch('/api/favorite-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: favorites }),
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Favoriler yüklenemedi.');
        const body = (await response.json()) as { products: LiveProduct[] };
        if (!Array.isArray(body.products)) throw new Error('Geçersiz favori yanıtı.');
        if (!controller.signal.aborted) setResult({ key, products: body.products, error: null });
      } catch {
        if (!controller.signal.aborted)
          setResult({ key, products: [], error: 'Favori ürünlerin şu anda yüklenemiyor.' });
      }
    }
    void loadFavorites();
    return () => controller.abort();
  }, [favorites, favoritesReady, key, retry]);

  const current = result?.key === key ? result : null;
  const loading = !favoritesReady || (favorites.length > 0 && !current);

  return (
    <div className="container-wide simple-page">
      <div className="breadcrumbs">
        <Link href="/">Ana Sayfa</Link> › Favorilerim
      </div>
      <h1>
        Favorilerim<span className="orange-dot">.</span>
      </h1>
      <p>Beğendiğin ürünleri burada bulabilirsin.</p>
      {loading ? (
        <p className="store-empty-note" role="status">Favori ürünlerin yükleniyor...</p>
      ) : current?.error ? (
        <div className="empty-page" role="alert">
          <Heart size={42} />
          <h2>Favoriler yüklenemedi</h2>
          <p>{current.error}</p>
          <button className="button button-outline" type="button" onClick={() => {
            setResult(null);
            setRetry((value) => value + 1);
          }}>
            Tekrar dene
          </button>
        </div>
      ) : current?.products.length ? (
        <div className="products-grid favorite-grid">
          {current.products.filter((product) => favorites.includes(product.id)).map((product) => (
            <LiveProductCard product={product} key={product.id} />
          ))}
        </div>
      ) : (
        <div className="empty-page">
          <Heart size={42} />
          <h2>{favorites.length ? 'Kaydettiğin ürünler şu anda satışta değil' : 'Henüz favori ürünün yok'}</h2>
          <p>Ürün kartlarındaki kalbe dokunarak favorilerine ekleyebilirsin.</p>
          <Link href="/urunler" className="button button-primary">
            Ürünleri keşfet <ArrowRight size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}
