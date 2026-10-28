/** Client-side feedback only. Database constraints and atomic stock RPCs remain authoritative. */
export const MAX_CATALOG_PRICE = 9_999_999_999.99;
export const MAX_VARIANT_PRICE = 999_999.99;
export const MAX_STOCK = 2_147_483_647;
export const MAX_STOCK_CHANGE = 100_000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type CatalogNumbers = { price: number; compare: number | null; stock: number; threshold: number };

function money(input: string, maximum: number): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value <= maximum ? value : null;
}

function integer(input: string, maximum: number): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value <= maximum ? value : null;
}

export function validateCatalogNumbers(
  input: { price: string; compare: string; stock: string; threshold: string },
  kind: 'product' | 'variant',
): Result<CatalogNumbers> {
  const maximum = kind === 'variant' ? MAX_VARIANT_PRICE : MAX_CATALOG_PRICE;
  const price = money(input.price, maximum);
  if (price === null)
    return {
      ok: false,
      error:
        'Geçerli satış fiyatı girin (en fazla iki ondalık basamak). Fiyat izin verilen sınırı aşmamalı.',
    };
  const compare = input.compare.trim() ? money(input.compare, MAX_CATALOG_PRICE) : null;
  if (input.compare.trim() && compare === null)
    return { ok: false, error: 'Geçerli eski fiyat girin (en fazla iki ondalık basamak).' };
  const stock = integer(input.stock, MAX_STOCK);
  const threshold = integer(input.threshold, MAX_STOCK);
  if (stock === null || threshold === null)
    return { ok: false, error: 'Stok ve uyarı limiti 0–2147483647 aralığında tam sayı olmalı.' };
  return { ok: true, value: { price, compare, stock, threshold } };
}

export function validateCatalogImage(file: { size: number; type: string } | null): string | null {
  if (!file) return null;
  if (
    !Number.isInteger(file.size) ||
    file.size <= 0 ||
    file.size > MAX_IMAGE_BYTES ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  ) {
    return 'Görsel PNG, JPG veya WebP ve 0 bayttan büyük, en fazla 5 MB olmalı.';
  }
  return null;
}

export function validateStockAdjustment(
  input: string,
  current: number,
  direction: 'increase' | 'decrease',
): Result<{ amount: number; change: number; resultingStock: number }> {
  const amount = integer(input, MAX_STOCK_CHANGE);
  if (amount === null || amount < 1)
    return { ok: false, error: 'Miktar 1–100000 aralığında tam sayı olmalı.' };
  const change = direction === 'increase' ? amount : -amount;
  const resultingStock = current + change;
  if (!Number.isInteger(current) || current < 0 || current > MAX_STOCK) {
    return {
      ok: false,
      error: 'Mevcut stok bilgisi geçersiz. Sayfayı yenileyin.',
    };
  }
  if (resultingStock < 0) return { ok: false, error: 'Mevcut stoktan fazla azaltamazsınız.' };
  if (resultingStock > MAX_STOCK)
    return { ok: false, error: 'Bu artış izin verilen stok sınırını aşıyor.' };
  return { ok: true, value: { amount, change, resultingStock } };
}

/** Costs are private admin data; this validates a single editor entry only. */
export function validateCostPrice(input: string): Result<number | null> {
  if (!input.trim()) return {ok:true,value:null};
  const value=input.trim().replace(',','.');
  if (!/^(?:\\d+(?:\\.\\d{1,2})?)$/.test(value))
    return {ok:false,error:'Alış maliyeti en fazla iki ondalık basamaklı olmalı.'};
  const cost=Number(value);
  if (!Number.isFinite(cost) || cost<0 || cost>MAX_CATALOG_PRICE)
    return {ok:false,error:'Alış maliyeti izin verilen aralığın dışında.'};
  return {ok:true,value:cost};
}
