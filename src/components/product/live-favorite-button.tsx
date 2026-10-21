'use client';

import { Heart } from 'lucide-react';
import { useShop } from '@/context/shop-context';

export function LiveFavoriteButton({ productId }: { productId: string }) {
  const { favorites, toggleFavorite } = useShop();
  const liked = favorites.includes(productId);
  return (
    <button
      type="button"
      className={`live-favorite-button ${liked ? 'is-favorite' : ''}`}
      onClick={() => toggleFavorite(productId)}
      aria-label={liked ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      aria-pressed={liked}
    >
      <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}
