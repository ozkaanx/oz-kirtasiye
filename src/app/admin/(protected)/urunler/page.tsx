import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminProducts } from '@/components/admin/admin-products';
import type { Product, StockEntry } from '@/components/admin/admin-product-types';
import {
  parseProductSearch,
  productSearchArgs,
  type ProductSearchMeta,
} from '@/lib/admin-product-search';
import { operationTrace } from '@/lib/operation-trace';
export const metadata: Metadata = {
  title: 'Ürün ve Stok Yönetimi',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = parseProductSearch(await searchParams);
  const trace = operationTrace('admin_product_search');
  const supabase = await createServerSupabase();
  const [catalog, categories, movements] = await Promise.all([
    supabase.rpc('admin_search_products', productSearchArgs(search)),
    supabase
      .from('categories')
      .select('id,parent_id,name,slug,description,image_path,sort_order,is_active')
      .order('sort_order'),
    supabase
      .from('stock_movements')
      .select('id,product_id,change_quantity,quantity_after,created_at,note,reason,products(name)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(30)
      .returns<(StockEntry & { products: { name: string } | null })[]>(),
  ]);
  const result =
    !catalog.error && catalog.data && Array.isArray(catalog.data.rows)
      ? (catalog.data as ProductSearchMeta & { rows: Omit<Product, 'imageUrl'>[] })
      : null;
  const error = catalog.error ?? categories.error ?? movements.error;
  let loadError: string | null = null;
  if (error || !result) {
    trace.error(error ? 'database_error' : 'empty_result', error?.code);
    loadError = 'Yönetim verileri yüklenemedi. Tekrar deneyin. Takip kodu: ' + trace.requestId;
  }
  const productIds=(result?.rows ?? []).map((p)=>p.id);
  const costs=productIds.length
    ? await supabase.from('product_costs')
        .select('product_id,cost_price').in('product_id',productIds)
    : {data:[] as {product_id:string;cost_price:number}[],error:null};
  if(costs.error) {
    trace.error('database_error',costs.error.code);
    loadError=loadError ?? 'Alış maliyetleri şu anda yüklenemiyor. Sayfayı yenileyin.';
  }
  const costById=new Map((costs.data??[]).map((row)=>[row.product_id,Number(row.cost_price)]));
  const products = (result?.rows ?? []).map((p) => {
    const path = p.product_images[0]?.storage_path;
    return {
      ...p,
      cost_price: costById.get(p.id) ?? null,
      imageUrl: path
        ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
        : null,
    };
  });
  return (
    <AdminProducts
      products={products}
      categories={categories.data ?? []}
      movements={(movements.data ?? []).map((m) => ({
        ...m,
        product_name: m.products?.name ?? 'Ürün',
      }))}
      search={search}
      result={result}
      loadError={loadError}
    />
  );
}
