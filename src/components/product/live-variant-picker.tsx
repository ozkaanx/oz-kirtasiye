'use client';

import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Package } from 'lucide-react';
import { LiveFavoriteButton } from './live-favorite-button';
import { useShop } from '@/context/shop-context';
import type { LiveVariant } from '@/lib/real-catalog';
import { formatPrice } from '@/lib/format';
import styles from './live-variant-picker.module.css';

export function LiveVariantPicker({
  productId,
  variants,
  imageUrl,
  galleryUrls,
  name,
  description,
}: {
  productId: string;
  variants: LiveVariant[];
  imageUrl: string | null;
  galleryUrls: string[];
  name: string;
  description: string | null;
}) {
  const active = variants.filter((v) => v.is_active);
  const [selectedId, setSelectedId] = useState<string>(
    active.find((v) => v.stock_quantity > 0)?.id ?? active[0]?.id ?? '',
  );
  const [amount, setAmount] = useState(1);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const { addToCart } = useShop();
  const selected = active.find((v) => v.id === selectedId) ?? null;
  const colors = [...new Set(active.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(active.map((v) => v.size).filter(Boolean))];
  const image =
    photoIndex != null
      ? (galleryUrls[photoIndex] ?? imageUrl)
      : (selected?.imageUrl ?? galleryUrls[0] ?? imageUrl);
  function selectVariant(variant: LiveVariant | undefined) {
    if (!variant) return;
    setSelectedId(variant.id);
    setAmount(1);
    setPhotoIndex(null);
  }
  function selectColor(color: string) {
    selectVariant(
      active.find((v) => v.color === color && v.size === selected?.size) ??
        active.find((v) => v.color === color),
    );
  }
  function selectSize(size: string) {
    selectVariant(
      active.find((v) => v.size === size && v.color === selected?.color) ??
        active.find((v) => v.size === size),
    );
  }
  return (
    <div className={styles.wrapper}>
      <div className={styles.gallery}>
        <div className={styles.hero}>
          {image ? <img src={image} alt={name} /> : <Package size={96} color="#b9c0c8" />}
        </div>
        {galleryUrls.length > 1 && (
          <div className={styles.thumbs}>
            {galleryUrls.map((url, index) => (
              <button
                type="button"
                key={url}
                onClick={() => setPhotoIndex(index)}
                aria-label={`Fotoğraf ${index + 1}`}
                aria-pressed={photoIndex === index}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.form}>
        <span className="section-eyebrow">ÖZ KIRTASİYE</span>
        <h1 className={styles.heading}>
          {name}
          <span className="orange-dot">.</span>
        </h1>
        <p className={styles.description}>{description ?? 'Ürün detayları yakında eklenecek.'}</p>
        <LiveFavoriteButton productId={productId} />
        {colors.length > 0 && (
          <fieldset className={styles.group}>
            <legend>
              Renk: <strong>{selected?.color || 'Seçiniz'}</strong>
            </legend>
            <div className={styles.options}>
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={styles.chip}
                  aria-pressed={selected?.color === color}
                  onClick={() => selectColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {sizes.length > 0 && (
          <fieldset className={styles.group}>
            <legend>
              Boyut / Ölçü: <strong>{selected?.size || 'Seçiniz'}</strong>
            </legend>
            <div className={styles.options}>
              {sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={styles.chip}
                  aria-pressed={selected?.size === size}
                  onClick={() => selectSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {active.length === 0 ? (
          <p role="status" className={styles.warning}>
            Bu ürün için henüz aktif seçenek bulunmuyor.
          </p>
        ) : (
          <>
            <div className={styles.price}>{selected && formatPrice(selected.price)}</div>
            {selected?.compare_at_price != null && selected.compare_at_price > selected.price && (
              <del>{formatPrice(selected.compare_at_price)}</del>
            )}
            <p className={styles.stock}>
              {selected && selected.stock_quantity > 0
                ? `${selected.stock_quantity} adet stokta`
                : 'Bu seçenek stokta yok'}
            </p>
            <div className={styles.buy}>
              <div className={styles.quantity}>
                <button
                  type="button"
                  aria-label="Adedi azalt"
                  disabled={amount <= 1}
                  onClick={() => setAmount((v) => v - 1)}
                >
                  <Minus size={16} />
                </button>
                <span>{amount}</span>
                <button
                  type="button"
                  aria-label="Adedi artır"
                  disabled={!selected || amount >= Math.min(selected.stock_quantity, 99)}
                  onClick={() => setAmount((v) => v + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                type="button"
                className="button button-primary"
                disabled={!selected || selected.stock_quantity === 0}
                onClick={() => selected && addToCart(productId, amount, selected.id)}
              >
                <ShoppingBag size={17} /> Sepete ekle
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
