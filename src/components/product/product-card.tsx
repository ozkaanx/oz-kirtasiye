"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Plus, ArrowUpRight } from "lucide-react";
import { useShop } from "@/context/shop-context";
import { categories } from "@/data/catalog";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/shop";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleFavorite, favorites } = useShop();
  const liked = favorites.includes(product.id);
  const category = categories.find((item) => item.id === product.category);
  return (
    <article className="product-card">
      <div className="product-photo" style={{ backgroundColor: product.tint }}>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button type="button" onClick={() => toggleFavorite(product.id)} className={`favorite-button ${liked ? "is-favorite" : ""}`} aria-label={liked ? `${product.name} favorilerimden çıkar` : `${product.name} favorilerime ekle`} aria-pressed={liked}><Heart size={19} fill={liked ? "currentColor" : "none"} /></button>
        <Link href={`/urun/${product.slug}`} className="product-image-link" aria-label={`${product.name} ürününü incele`}><Image src={product.image} alt={product.name} width={300} height={255} className="product-art" /></Link>
      </div>
      <div className="product-information">
        <div className="product-category">{category?.label}</div>
        <Link href={`/urun/${product.slug}`} className="product-title">{product.name}</Link>
        <div className="product-buy-row"><div className="product-prices">{product.oldPrice && <span className="old-price">{formatPrice(product.oldPrice)}</span>}<span className="current-price">{formatPrice(product.price)}</span></div><button className="add-cart-button" aria-label={`${product.name} sepete ekle`} onClick={() => addToCart(product.id)}><Plus size={20} strokeWidth={2.5} /></button></div>
      </div>
    </article>
  );
}
