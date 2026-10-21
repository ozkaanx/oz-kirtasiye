import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminProducts } from "@/components/admin/admin-products";

export const metadata: Metadata = {
  title: "Ürün ve Stok Yönetimi",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createServerSupabase();
  const [
    { data: products, error: productError },
    { data: categories, error: categoryError },
    { data: movements },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,name,slug,description,category_id,sku,price,compare_at_price,stock_quantity,low_stock_threshold,is_active,is_featured,product_images(storage_path,sort_order)",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("categories").select("id,name,slug").order("sort_order"),
    supabase
      .from("stock_movements")
      .select(
        "id,product_id,change_quantity,quantity_after,created_at,note,reason",
      )
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const withImages = (products ?? []).map((p) => {
    const path = p.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    return {
      ...p,
      imageUrl: path
        ? supabase.storage.from("product-images").getPublicUrl(path).data
            .publicUrl
        : null,
    };
  });
  return (
    <AdminProducts
      products={withImages}
      categories={categories ?? []}
      movements={movements ?? []}
      loadError={productError?.message ?? categoryError?.message ?? null}
    />
  );
}
