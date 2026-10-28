import { createServerSupabase } from '@/lib/supabase/server';
import { createOrderServerClient } from '@/lib/supabase/order-server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import type { StoreCategory } from '@/lib/category-utils';
import { flattenCategories } from '@/lib/category-utils';

/** Informational discount for exactly one unit, without a coupon or basket campaign. */
export type CatalogPromotion = {
  campaignName: string;
  discountAmount: number;
  discountedPrice: number;
  discountPercent: number;
};

/** Promotion unlocked by a minimum basket amount; shown as a notice, not a reduced product price. */
export type CatalogCampaignNotice = {
  campaignName: string;
  minSubtotal: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  maxDiscount: number | null;
};

export type LiveVariant = {
  id: string;
  color: string;
  size: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  imageUrl: string | null;
  is_active: boolean;
  promotion: CatalogPromotion | null;
  campaignNotice: CatalogCampaignNotice | null;
};

export type LiveProduct = {
  has_variants: boolean;
  variants: LiveVariant[];
  galleryUrls: string[];
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
  imageUrl: string | null;
  promotion: CatalogPromotion | null;
  campaignNotice: CatalogCampaignNotice | null;
};

export const PRODUCT_FIELDS =
  'id,slug,name,description,category_id,price,compare_at_price,stock_quantity,has_variants,is_featured,created_at,product_images(storage_path,sort_order),product_variants(id,color,size,price,compare_at_price,stock_quantity,image_path,is_active,sort_order)';

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
  product_images: { storage_path: string; sort_order: number }[] | null;
  has_variants: boolean;
  product_variants:
    | {
        id: string;
        color: string;
        size: string;
        price: string | number;
        compare_at_price: number | string | null;
        stock_quantity: number;
        image_path: string | null;
        is_active: boolean;
        sort_order: number;
      }[]
    | null;
};

type PromotionRow = {
  product_id: string;
  variant_id: string | null;
  campaign_name: string;
  original_price: number | string;
  discount_amount: number | string;
  discounted_price: number | string;
};

type CampaignNoticeRow = {
  product_id: string;
  variant_id: string | null;
  campaign_name: string;
  min_subtotal: number | string;
  discount_type: string;
  discount_value: number | string;
  max_discount: number | string | null;
};

function promotionKey(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? 'standard'}`;
}

/** The RPC is service-role-only: no internal campaign configuration reaches the browser. */
async function loadCatalogPromotions(rows: ProductRow[]) {
  const result = new Map<string, CatalogPromotion>();
  if (!rows.length || !process.env.SUPABASE_SECRET_KEY) return result;
  try {
    const service = createOrderServerClient();
    const productId = rows.length === 1 ? rows[0].id : null;
    const pageSize = 1000;
    for (let offset = 0; offset < 5000; offset += pageSize) {
      const { data, error } = await service
        .rpc('catalog_campaign_previews', { p_product_id: productId })
        .in(
          'product_id',
          rows.map((row) => row.id),
        )
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error('Katalog kampanya fiyatları okunamadı:', error.message);
        return new Map<string, CatalogPromotion>();
      }
      const batch = (data ?? []) as PromotionRow[];
      for (const row of batch) {
        const original = Number(row.original_price);
        const discount = Number(row.discount_amount);
        const discounted = Number(row.discounted_price);
        if (
          !Number.isFinite(original) ||
          !Number.isFinite(discount) ||
          !Number.isFinite(discounted) ||
          original <= 0 ||
          discount <= 0 ||
          discounted < 0 ||
          discounted >= original
        )
          continue;
        result.set(promotionKey(row.product_id, row.variant_id), {
          campaignName: row.campaign_name,
          discountAmount: discount,
          discountedPrice: discounted,
          discountPercent: Math.max(1, Math.round((discount / original) * 100)),
        });
      }
      if (batch.length < pageSize) break;
      if (offset + pageSize >= 5000) {
        // Do not display incomplete campaign prices when a very large catalog exceeds the cap.
        console.error('Kampanya fiyat ön izleme kayıt sınırını aştı.');
        return new Map<string, CatalogPromotion>();
      }
    }
  } catch (cause) {
    console.error('Kampanya ön izlemesi erişilemedi:', cause);
    return new Map<string, CatalogPromotion>();
  }
  return result;
}

/** Campaign conditions are fetched through a service-only, read-only RPC. */
async function loadCatalogNotices(rows: ProductRow[]) {
  const result = new Map<string, CatalogCampaignNotice>();
  if (!rows.length || !process.env.SUPABASE_SECRET_KEY) return result;

  try {
    const service = createOrderServerClient();
    const productId = rows.length === 1 ? rows[0].id : null;
    const ids = rows.map((row) => row.id);
    const pageSize = 1000;
    for (let offset = 0; offset < 5000; offset += pageSize) {
      const { data, error } = await service
        .rpc('catalog_campaign_notices', { p_product_id: productId })
        .in('product_id', ids)
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error('Katalog kampanya koşulları okunamadı:', error.message);
        return new Map<string, CatalogCampaignNotice>();
      }
      const batch = (data ?? []) as CampaignNoticeRow[];
      for (const row of batch) {
        const minimum = Number(row.min_subtotal);
        const value = Number(row.discount_value);
        const cap = row.max_discount == null ? null : Number(row.max_discount);
        if (
          !Number.isFinite(minimum) ||
          minimum <= 0 ||
          !Number.isFinite(value) ||
          value <= 0 ||
          (cap != null && (!Number.isFinite(cap) || cap <= 0)) ||
          (row.discount_type !== 'percent' && row.discount_type !== 'fixed')
        )
          continue;
        result.set(promotionKey(row.product_id, row.variant_id), {
          campaignName: row.campaign_name,
          minSubtotal: minimum,
          discountType: row.discount_type,
          discountValue: value,
          maxDiscount: cap,
        });
      }
      if (batch.length < pageSize) break;
      if (offset + pageSize >= 5000) {
        console.error('Kampanya koşulu ön izleme kayıt sınırını aştı.');
        return new Map<string, CatalogCampaignNotice>();
      }
    }
  } catch (cause) {
    console.error('Katalog kampanya koşullarına erişilemedi:', cause);
    return new Map<string, CatalogCampaignNotice>();
  }
  return result;
}

export async function transformRows(rows: ProductRow[]) {
  if (!rows.length) return [];
  const [supabase, promotions, notices] = await Promise.all([
    createServerSupabase(),
    loadCatalogPromotions(rows),
    loadCatalogNotices(rows),
  ]);
  return rows.map((product): LiveProduct => {
    const path = product.product_images
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
    const galleryUrls = (product.product_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (photo) =>
          supabase.storage.from('product-images').getPublicUrl(photo.storage_path).data.publicUrl,
      );
    const variants: LiveVariant[] = (product.product_variants ?? [])
      .filter((variant) => variant.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => ({
        id: variant.id,
        color: variant.color,
        size: variant.size,
        price: Number(variant.price),
        compare_at_price:
          variant.compare_at_price == null ? null : Number(variant.compare_at_price),
        stock_quantity: variant.stock_quantity,
        is_active: variant.is_active,
        imageUrl: variant.image_path
          ? supabase.storage.from('product-images').getPublicUrl(variant.image_path).data.publicUrl
          : null,
        promotion: promotions.get(promotionKey(product.id, variant.id)) ?? null,
        campaignNotice: notices.get(promotionKey(product.id, variant.id)) ?? null,
      }));
    const available = variants.filter((variant) => variant.stock_quantity > 0);
    const candidates = available.length ? available : variants;
    const featuredVariant = [...candidates].sort((a, b) => {
      const aPrice = a.promotion?.discountedPrice ?? a.price;
      const bPrice = b.promotion?.discountedPrice ?? b.price;
      return aPrice - bPrice || a.price - b.price;
    })[0];
    return {
      has_variants: product.has_variants,
      variants,
      galleryUrls,
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      price: product.has_variants
        ? (featuredVariant?.price ?? Number(product.price))
        : Number(product.price),
      compare_at_price: product.has_variants
        ? null
        : product.compare_at_price == null
          ? null
          : Number(product.compare_at_price),
      stock_quantity: product.has_variants
        ? variants.reduce((sum, variant) => sum + variant.stock_quantity, 0)
        : product.stock_quantity,
      is_featured: product.is_featured,
      created_at: product.created_at,
      imageUrl:
        featuredVariant?.imageUrl ??
        (path ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl : null),
      promotion: product.has_variants
        ? (featuredVariant?.promotion ?? null)
        : (promotions.get(promotionKey(product.id, null)) ?? null),
      campaignNotice: product.has_variants
        ? (featuredVariant?.campaignNotice ?? null)
        : (notices.get(promotionKey(product.id, null)) ?? null),
    };
  });
}

export async function getLiveProductBySlug(slug: string): Promise<LiveProduct | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return (await transformRows([data as ProductRow]))[0] ?? null;
}

export async function getLiveCategories(): Promise<StoreCategory[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('categories')
    .select('id,parent_id,name,slug,description,image_path,sort_order,is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('Kategoriler okunamadı:', error.message);
    return [];
  }
  const all = (data ?? []) as StoreCategory[];
  const visibleIds = new Set<string>();
  const { length } = all;
  for (let pass = 0; pass < length + 1; pass++) {
    all.forEach((cat) => {
      if (!cat.parent_id || visibleIds.has(cat.parent_id)) visibleIds.add(cat.id);
    });
  }
  return flattenCategories(all.filter((cat) => visibleIds.has(cat.id))).map(
    (entry) => entry.category,
  );
}
