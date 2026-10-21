import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, products } from "@/data/catalog";
import { ProductDetail } from "@/components/product/product-detail";
export function generateStaticParams(){return products.map(p=>({slug:p.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const p=getProductBySlug(slug);return {title:p?.name??"Ürün bulunamadı"};}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=getProductBySlug(slug);if(!p)notFound();return <ProductDetail product={p}/>;}
