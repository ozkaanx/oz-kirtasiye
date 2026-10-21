import { HomeStorefront } from "@/components/home/home-storefront";
import { getLiveProducts } from "@/lib/real-catalog";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const liveProducts = await getLiveProducts();
  return <HomeStorefront liveProducts={liveProducts}/>;
}
