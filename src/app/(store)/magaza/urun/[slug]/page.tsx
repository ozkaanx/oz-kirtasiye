import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { getLiveProductBySlug } from "@/lib/real-catalog";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{slug:string}> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getLiveProductBySlug(slug);
  return {title: product?.name ?? "Ürün bulunamadı", description: product?.description ?? undefined};
}
export default async function Page({ params }: { params: Promise<{ slug:string }> }) {
  const { slug } = await params;
  const product = await getLiveProductBySlug(slug);
  if (!product) notFound();
  return <main className="container-wide">
    <div className="breadcrumbs"><Link href="/urunler"><ArrowLeft size={15}/> Ürünlere geri dön</Link></div>
    <section className="real-detail-card">
      <div className="real-detail-photo">
        {product.imageUrl?<img src={product.imageUrl} alt={product.name}/>:<Package size={100} color="#bcc0c9"/>}
      </div>
      <div className="real-detail-info">
        <span className="section-eyebrow">ÖZ KIRTASİYE</span>
        <h1>{product.name}<span className="orange-dot">.</span></h1>
        <div className="real-detail-price">{formatPrice(product.price)}</div>
        <p>{product.description ?? "Ürün detayları yakında eklenecek."}</p>
        <p><strong>{product.stock_quantity > 0?`${product.stock_quantity} adet stokta`:"Stokta yok"}</strong></p>
        <p className="real-no-checkout">Online ödeme ve sipariş henüz aktif değil. Bu ürün şu anda yalnızca görüntülenebilir.</p>
        <Link className="button button-primary" href="/iletisim">Mağazaya ulaş</Link>
      </div>
    </section>
  </main>;
}
