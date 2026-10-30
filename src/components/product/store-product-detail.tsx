'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Package, Truck, MapPin, Share2, ChevronDown } from 'lucide-react';
import type { LiveProduct, LiveVariant } from '@/lib/real-catalog';
import type { StoreSettings } from '@/lib/store-profile';
import { formatProductPrice } from '@/lib/format';
import { useShop } from '@/context/shop-context';
import { CampaignPrice } from './campaign-price';
import { LiveFavoriteButton } from './live-favorite-button';
import styles from './store-product-detail.module.css';

export function StoreProductDetail({
  product,
  settings,
  initialVariantId,
}: {
  product: LiveProduct;
  settings: StoreSettings;
  initialVariantId?: string;
}) {
  const active = product.variants.filter((item) => item.is_active);
  const [selectedId, setSelectedId] = useState(
    () =>
      active.find((item) => item.id === initialVariantId)?.id ??
      [...active].sort(
        (a, b) =>
          Number(b.stock_quantity > 0) - Number(a.stock_quantity > 0) ||
          (a.promotion?.discountedPrice ?? a.price) - (b.promotion?.discountedPrice ?? b.price),
      )[0]?.id ??
      '',
  );
  const selected = active.find((item) => item.id === selectedId);
  const [amount, setAmount] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const { addToCart } = useShop();
  const stock = product.has_variants ? (selected?.stock_quantity ?? 0) : product.stock_quantity;
  const price = product.has_variants ? (selected?.price ?? product.price) : product.price;
  const photos = [
    ...new Set(
      [selected?.imageUrl, product.imageUrl, ...product.galleryUrls].filter(
        (url): url is string => !!url,
      ),
    ),
  ];
  const currentPhoto = photo && photos.includes(photo) ? photo : photos[0];
  const colors = [...new Set(active.map((item) => item.color).filter(Boolean))];
  const sizes = [...new Set(active.map((item) => item.size).filter(Boolean))];
  function choose(variant: LiveVariant | undefined) {
    if (!variant) return;
    setSelectedId(variant.id);
    setAmount(1);
    setPhoto(null);
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: product.name, url: location.href });
      else {
        await navigator.clipboard.writeText(location.href);
        setShareMessage('Ürün bağlantısı kopyalandı.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setShareMessage(
          'Paylaşım açılamadı. Adres çubuğundaki ürün bağlantısını kopyalayabilirsin.',
        );
    }
  }
  return (
    <section className={styles.layout} aria-label="Ürün bilgileri">
      <div className={styles.gallery}>
        <div className={styles.hero}>
          {currentPhoto ? (
            <Image
              src={currentPhoto}
              alt={product.name}
              width={900}
              height={900}
              priority
              sizes="(max-width:800px) calc(100vw - 28px), 48vw"
            />
          ) : (
            <Package size={100} color="#a7a7a7" />
          )}
          <LiveFavoriteButton productId={product.id} />
        </div>
        {photos.length > 1 && (
          <div className={styles.thumbs} aria-label="Ürün fotoğrafları">
            {photos.map((url, index) => (
              <button
                type="button"
                key={url}
                onClick={() => setPhoto(url)}
                aria-label={`Fotoğraf ${index + 1}`}
                aria-pressed={currentPhoto === url}
              >
                <Image src={url} alt="" width={76} height={76} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.info}>
        <h1>{product.name}</h1>
        <CampaignPrice
          price={price}
          compareAtPrice={
            product.has_variants ? (selected?.compare_at_price ?? null) : product.compare_at_price
          }
          promotion={product.has_variants ? (selected?.promotion ?? null) : product.promotion}
          campaignNotice={
            product.has_variants ? (selected?.campaignNotice ?? null) : product.campaignNotice
          }
          size="detail"
        />
        {product.has_variants && (
          <div className={styles.variants}>
            {colors.length > 0 && (
              <fieldset>
                <legend>
                  Renk: <strong>{selected?.color}</strong>
                </legend>
                <div>
                  {colors.map((color) => (
                    <button
                      type="button"
                      key={color}
                      aria-pressed={selected?.color === color}
                      onClick={() =>
                        choose(
                          active.find(
                            (item) => item.color === color && item.size === selected?.size,
                          ) ?? active.find((item) => item.color === color),
                        )
                      }
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {sizes.length > 0 && (
              <fieldset>
                <legend>
                  Boyut / Ölçü: <strong>{selected?.size}</strong>
                </legend>
                <div>
                  {sizes.map((size) => (
                    <button
                      type="button"
                      key={size}
                      aria-pressed={selected?.size === size}
                      onClick={() =>
                        choose(
                          active.find(
                            (item) => item.size === size && item.color === selected?.color,
                          ) ?? active.find((item) => item.size === size),
                        )
                      }
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}
        <p className={styles.stock} role="status">
          {stock > 0 ? `${stock} adet stokta` : 'Bu ürün şu anda stokta yok.'}
        </p>
        <div className={styles.buy}>
          <div className={styles.quantity}>
            <button
              type="button"
              aria-label="Adedi azalt"
              disabled={amount <= 1}
              onClick={() => setAmount((value) => value - 1)}
            >
              <Minus size={16} />
            </button>
            <span>{amount}</span>
            <button
              type="button"
              aria-label="Adedi artır"
              disabled={amount >= Math.min(stock, 99)}
              onClick={() => setAmount((value) => value + 1)}
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            className={styles.add}
            type="button"
            disabled={stock <= 0}
            onClick={() =>
              addToCart(product.id, amount, product.has_variants ? selected?.id : undefined)
            }
          >
            {stock > 0 ? 'Sepete ekle' : 'Stokta yok'}
          </button>
        </div>
        <p className={styles.notice}>
          Online ödeme henüz aktif değil. Sepetinden sipariş talebi gönderebilirsin.
        </p>
        <div className={styles.accordions}>
          <details open>
            <summary>
              Ürün Detayları
              <ChevronDown size={18} />
            </summary>
            <div className={styles.description}>
              <p className={expanded ? undefined : styles.collapsed}>
                {product.description?.trim() ||
                  'Bu ürün için henüz açıklama eklenmedi. Ayrıntılar için mağazamızla iletişime geçebilirsin.'}
              </p>
              {!!product.description && product.description.length > 240 && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Daha az göster' : 'Daha fazla göster'}
                </button>
              )}
            </div>
          </details>
          <details open>
            <summary>
              Teslimat Detayları
              <ChevronDown size={18} />
            </summary>
            <div className={styles.delivery}>
              {settings.shipping_enabled && settings.shipping_flat_fee !== null && (
                <div>
                  <Truck size={20} />
                  <span>
                    Standart teslimat {formatProductPrice(settings.shipping_flat_fee)}
                    {settings.free_shipping_threshold !== null && (
                      <small>
                        {formatProductPrice(settings.free_shipping_threshold)} ve üzeri indirim
                        sonrası ürün toplamında ücretsiz kargo.
                      </small>
                    )}
                  </span>
                </div>
              )}
              {settings.pickup_enabled && (
                <div>
                  <MapPin size={20} />
                  <span>
                    Mağazadan teslim alabilirsin.<small>{settings.pickup_instructions}</small>
                  </span>
                </div>
              )}
              {settings.shipping_information && <p>{settings.shipping_information}</p>}
              {!settings.shipping_enabled && !settings.pickup_enabled && (
                <p>
                  Teslimat seçenekleri için <Link href="/iletisim">bizimle iletişime geç.</Link>
                </p>
              )}
            </div>
          </details>
          <details>
            <summary>
              Hangi Mağazada Var
              <ChevronDown size={18} />
            </summary>
            <div className={styles.description}>
              <strong>Öz Kırtasiye</strong>
              <p>{settings.registered_address}</p>
              {settings.business_hours && <p>{settings.business_hours}</p>}
              <Link href="/iletisim">İletişim ve konum</Link>
            </div>
          </details>
        </div>
        <button className={styles.share} type="button" onClick={() => void share()}>
          <Share2 size={18} /> Paylaş
        </button>
        {shareMessage && <p role="status">{shareMessage}</p>}
      </div>
      <div className={styles.mobileBuy} aria-label="Hızlı satın alma">
        <strong>
          {formatProductPrice(
            selected?.promotion?.discountedPrice ?? product.promotion?.discountedPrice ?? price,
          )}
        </strong>
        <button
          className={styles.add}
          type="button"
          disabled={stock <= 0}
          onClick={() =>
            addToCart(product.id, amount, product.has_variants ? selected?.id : undefined)
          }
        >
          {stock > 0 ? 'Sepete ekle' : 'Stokta yok'}
        </button>
      </div>
    </section>
  );
}
