import { createServerSupabase } from '@/lib/supabase/server';
import {
  MAX_IMPORT_BYTES,
  normalizeImportTable,
  parseDelimitedTable,
} from '@/lib/admin-bulk-import';
import { parseXlsxFirstSheet } from '@/lib/admin-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(message: string, status: number) {
  return Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return json('Başka bir siteden ürün aktarımı yapılamaz.',403);
  }
  const length=Number(request.headers.get('content-length')??0);
  if (!Number.isFinite(length) || length > MAX_IMPORT_BYTES + 20000)
    return json('Dosya 2 MB boyut sınırını aşıyor.',413);

  let db: Awaited<ReturnType<typeof createServerSupabase>>;
  try {
    db=await createServerSupabase();
    const {data:{user},error:userError}=await db.auth.getUser();
    if(userError || !user) return json('Lütfen yönetici hesabıyla giriş yapın.',401);
    const {data:admin,error:adminError}=await db.from('store_admins')
      .select('role').eq('user_id',user.id).maybeSingle();
    if(adminError) throw adminError;
    if(!admin) return json('Yönetici yetkisi gerekli.',403);
  } catch {
    return json('Yönetici oturumu doğrulanamadı.',503);
  }

  try {
    const form=await request.formData();
    const file=form.get('file');
    const mode=form.get('mode');
    const allowStockUpdates=form.get('allowStockUpdates')==='true';
    if (!(file instanceof File) || (mode!=='preview' && mode!=='commit'))
      return json('Dosya ve işlem türü zorunlu.',400);
    if(file.size===0 || file.size>MAX_IMPORT_BYTES) return json('Dosya 1 bayt–2 MB arasında olmalı.',413);
    const name=file.name.toLowerCase();
    if(!name.endsWith('.csv') && !name.endsWith('.xlsx'))
      return json('Yalnızca .csv ve .xlsx dosyaları kabul edilir.',415);
    const bytes=Buffer.from(await file.arrayBuffer());
    const table=name.endsWith('.xlsx')
      ? parseXlsxFirstSheet(bytes)
      : parseDelimitedTable(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    const rows=normalizeImportTable(table);
    const {data,error}=await db.rpc('admin_bulk_import_products',{
      p_rows:rows,
      p_commit:mode==='commit',
      p_allow_stock_updates:allowStockUpdates,
    });
    if(error) {
      const business=['22023','23505'];
      if(business.includes(error.code))
        return json(error.message.slice(0,320),error.code==='23505'?409:400);
      if(error.code==='42501') return json('Yönetici yetkisi gerekli.',403);
      console.error('admin_product_import_rpc_failed',{code:error.code});
      return json('Ürün aktarımı yapılamadı. Veritabanı güncellemesini kontrol edin.',503);
    }
    return Response.json({
      ...data,
      rows: mode==='preview'
        ? (data.rows??[]).map((entry:{sku:string;action:string;row:number},index:number)=>({
            ...entry,
            ...rows[index],
          }))
        : data.rows,
      mode,
    },{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const message=error instanceof Error?error.message:'Dosya okunamadı.';
    // Never return database stack traces, file paths, or unknown internal errors.
    if (/^(Satır |CSV |XLSX |Excel |Dosya |SKU |Bir dosyada |Başlık |Bilinmeyen |Tekrarlanan |Geçersiz |Yalnızca |Formül)/.test(message))
      return json(message.slice(0,350),400);
    console.error('admin_product_import_parse_failed');
    return json('Dosya biçimi okunamadı. Excel dosyasını .xlsx veya UTF-8 CSV olarak kaydedin.',400);
  }
}
