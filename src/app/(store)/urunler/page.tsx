import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";
export const metadata:Metadata={title:"Tüm Ürünler"};
export default async function ProductsPage({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}){
  const params=await searchParams;
  return <CatalogView key={`${params.category??"all"}-${params.q??""}`} initialCategory={params.category??"all"} initialSearch={params.q??""}/>;
}
