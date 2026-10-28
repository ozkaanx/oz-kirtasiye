import { slugifyTurkish } from './category-utils.ts';

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type ImportRow = {
  sku: string;
  slug: string;
  name?: string;
  price?: number;
  cost_price?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  category_slug?: string;
  is_active?: boolean;
  description?: string;
};

export const IMPORT_HEADERS = [
  'sku', 'name', 'category_slug', 'price', 'cost_price',
  'stock_quantity', 'low_stock_threshold', 'is_active', 'description',
] as const;
type ImportField = (typeof IMPORT_HEADERS)[number];

const ALIASES: Record<string, ImportField> = {
  sku: 'sku', urun_kodu: 'sku', stok_kodu: 'sku',
  name: 'name', urun_adi: 'name', urun_ismi: 'name',
  category_slug: 'category_slug', kategori_kodu: 'category_slug', kategori_slug: 'category_slug',
  price: 'price', satis_fiyati: 'price', fiyat: 'price',
  cost_price: 'cost_price', alis_maliyeti: 'cost_price', maliyet: 'cost_price',
  stock_quantity: 'stock_quantity', stok: 'stock_quantity', stok_adedi: 'stock_quantity',
  low_stock_threshold: 'low_stock_threshold', kritik_stok: 'low_stock_threshold',
  is_active: 'is_active', yayinda: 'is_active', aktif: 'is_active',
  description: 'description', aciklama: 'description',
};

function normalizedHeader(value: string) {
  return slugifyTurkish(value.trim().replace(/_/g, ' ')).replaceAll('-', '_');
}

function detectDelimiter(value: string): ',' | ';' | '\t' {
  const header = value.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const count = (char: string) => {
    let n = 0, quoted = false;
    for (const ch of header) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === char) n++;
    }
    return n;
  };
  const candidates = [',',';','\t'] as const;
  return [...candidates].sort((a,b) => count(b) - count(a))[0];
}

export function parseDelimitedTable(value: string): string[][] {
  if (value.length > MAX_IMPORT_BYTES) throw new Error('CSV dosyası 2 MB sınırını aşıyor.');
  const text = value.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
      continue;
    }
    if (ch === '"' && !closed && !field) { quoted = true; continue; }
    if (ch === delimiter) {
      row.push(field); field = ''; closed = false;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; field = ''; closed = false;
      if (rows.length > MAX_IMPORT_ROWS + 1)
        throw new Error(`Bir dosyada en fazla ${MAX_IMPORT_ROWS} ürün bulunabilir.`);
    } else if (closed || ch === '"') {
      throw new Error('CSV dosyasında tırnak işaretleri hatalı.');
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error('CSV dosyasında kapatılmamış tırnak var.');
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length > MAX_IMPORT_ROWS + 1)
    throw new Error(`Bir dosyada en fazla ${MAX_IMPORT_ROWS} ürün bulunabilir.`);
  return rows;
}

function parseMoney(value: string, line: number, label: string) {
  let v = value.trim().replace(/\s|₺/g, '');
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(v)) v = v.replaceAll('.','').replace(',','.');
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(v)) v = v.replaceAll(',','');
  else v = v.replace(',','.');
  if (!/^(?:\d+(?:\.\d{1,2})?)$/.test(v) || Number(v) > 9999999999.99)
    throw new Error(`Satır ${line}: ${label} geçersiz. Örnek: 39,90`);
  return Number(v);
}
function parseQuantity(value: string, line: number, label: string) {
  if (!/^\d+$/.test(value.trim()) || Number(value) > 2147483647)
    throw new Error(`Satır ${line}: ${label} negatif olmayan tam sayı olmalı.`);
  return Number(value);
}
function parseBoolean(value: string, line: number) {
  const v = slugifyTurkish(value);
  if (['1','evet','true','aktif','yes','yayinda'].includes(v)) return true;
  if (['0','hayir','false','pasif','no','yayin-disi'].includes(v)) return false;
  throw new Error(`Satır ${line}: Yayın durumu evet/hayır olmalı.`);
}

export function normalizeImportTable(rows: string[][]): ImportRow[] {
  if (rows.length < 2) throw new Error('Başlık satırından sonra en az bir ürün gerekli.');
  const columns = rows[0].map((value) => ALIASES[normalizedHeader(value)]);
  const seenColumns = new Set<string>();
  for (let i=0;i<columns.length;i++) {
    if (!columns[i]) throw new Error(`Bilinmeyen dosya sütunu: ${rows[0][i] || '(boş)'}`);
    if (seenColumns.has(columns[i]))
      throw new Error(`Tekrarlanan başlık: ${rows[0][i]}`);
    seenColumns.add(columns[i]);
  }
  if (!seenColumns.has('sku'))
    throw new Error('Dosyada "sku" veya "ürün kodu" sütunu zorunlu.');
  if (seenColumns.size === 1)
    throw new Error('SKU dışında güncellenecek en az bir alan gerekli.');
  if (rows.length - 1 > MAX_IMPORT_ROWS)
    throw new Error(`Bir dosyada en fazla ${MAX_IMPORT_ROWS} ürün bulunabilir.`);

  const usedSku = new Set<string>();
  return rows.slice(1).map((cells, index) => {
    const line = index + 2;
    if (cells.length > columns.length && cells.slice(columns.length).some((s) => s.trim()))
      throw new Error(`Satır ${line}: Başlık sayısından fazla sütun var.`);
    const record = {} as Record<ImportField,string>;
    columns.forEach((key,i) => { if (key) record[key] = (cells[i] ?? '').trim(); });
    const sku = (record.sku ?? '').toUpperCase();
    if (!/^[A-Z0-9_-]{2,64}$/.test(sku))
      throw new Error(`Satır ${line}: SKU 2-64 karakter olmalı; A-Z, 0-9, _ veya - kullanın.`);
    if (usedSku.has(sku))
      throw new Error(`Satır ${line}: Dosyada tekrarlanan SKU (${sku}).`);
    usedSku.add(sku);
    const name = record.name;
    if (name && (name.length < 2 || name.length > 200))
      throw new Error(`Satır ${line}: Ürün adı 2-200 karakter olmalı.`);
    if (record.description && record.description.length > 3000)
      throw new Error(`Satır ${line}: Açıklama 3000 karakteri aşamaz.`);
    const row: ImportRow = { sku, slug: `${slugifyTurkish(name || 'urun').slice(0,105)}-${slugifyTurkish(sku).slice(0,65)}` };
    if (name) row.name = name;
    if (record.price) row.price = parseMoney(record.price,line,'Satış fiyatı');
    if (record.cost_price) row.cost_price = parseMoney(record.cost_price,line,'Alış maliyeti');
    if (record.stock_quantity) row.stock_quantity = parseQuantity(record.stock_quantity,line,'Stok');
    if (record.low_stock_threshold)
      row.low_stock_threshold = parseQuantity(record.low_stock_threshold,line,'Kritik stok');
    if (record.category_slug) {
      const category = slugifyTurkish(record.category_slug);
      if (!category || category.length > 180)
        throw new Error(`Satır ${line}: Kategori kodu geçersiz.`);
      row.category_slug = category;
    }
    if (record.is_active) row.is_active = parseBoolean(record.is_active,line);
    if (record.description) row.description = record.description;
    return row;
  });
}

export const IMPORT_TEMPLATE_CSV =
  '\uFEFFsku;name;category_slug;price;cost_price;stock_quantity;low_stock_threshold;is_active;description\r\n' +
  'DEFTER-A5-01;A5 Çizgili Defter;;39,90;22,50;12;5;hayır;Örnek ürün - varsa kategori kodunu girin\r\n';
