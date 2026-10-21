'use client';

import { useState } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useShop } from '@/context/shop-context';

export function LivePurchaseButton({
  productId,
  stock,
  detail = false,
}: {
  productId: string;
  stock: number;
  detail?: boolean;
}) {
  const [amount, setAmount] = useState(1);
  const { addToCart } = useShop();
  if (stock <= 0)
    return (
      <button className="button button-outline" disabled>
        Stokta yok
      </button>
    );
  return (
    <div className={detail ? 'real-detail-buy' : 'live-card-buy'}>
      {detail && (
        <div className="quantity-picker detail-picker">
          <button
            type="button"
            aria-label="Adedi azalt"
            disabled={amount <= 1}
            onClick={() => setAmount((n) => n - 1)}
          >
            <Minus size={16} />
          </button>
          <strong>{amount}</strong>
          <button
            type="button"
            aria-label="Adedi artır"
            disabled={amount >= Math.min(stock, 99)}
            onClick={() => setAmount((n) => n + 1)}
          >
            <Plus size={16} />
          </button>
        </div>
      )}
      <button
        type="button"
        className="button button-primary"
        onClick={() => addToCart(productId, amount)}
      >
        <ShoppingBag size={17} /> Sepete ekle
      </button>
    </div>
  );
}
