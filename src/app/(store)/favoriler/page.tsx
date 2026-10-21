"use client";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import {useShop} from "@/context/shop-context";
import {products} from "@/data/catalog";
import {ProductCard} from "@/components/product/product-card";
export default function Page(){const {favorites}=useShop();const selected=products.filter(p=>favorites.includes(p.id));return <div className="container-wide simple-page"><div className="breadcrumbs"><Link href="/">Ana Sayfa</Link> › Favorilerim</div><h1>Favorilerim<span className="orange-dot">.</span></h1><p>Beğendiğin ürünleri burada bulabilirsin.</p>{selected.length?<div className="products-grid favorite-grid">{selected.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="empty-page"><Heart size={42}/><h2>Henüz favori ürünün yok</h2><p>Ürün kartlarındaki kalbe dokunarak favorilerine ekleyebilirsin.</p><Link href="/urunler" className="button button-primary">Ürünleri keşfet <ArrowRight size={18}/></Link></div>}</div>}
