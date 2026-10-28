import { inflateRawSync } from 'node:zlib';

/**
 * Small, read-only XLSX sheet extractor. No external package or external
 * entities are used; limits protect against compressed/expanded ZIP bombs.
 * Supports standard Excel workbooks (first sheet, shared/inline strings).
 */
const MAX_XML_BYTES = 6 * 1024 * 1024;
const MAX_ENTRIES = 120;
const MAX_WORKBOOK_XML = 12 * 1024 * 1024;
const MAX_SHEET_ROWS = 201;
const MAX_COLUMNS = 24;

type ZipEntry = {
  offset: number;
  compressed: number;
  uncompressed: number;
  crc: number;
  method: number;
};

function zipEntries(bytes: Buffer): Map<string,ZipEntry> {
  let eocd = -1;
  const lower = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= lower; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Geçersiz XLSX arşivi.');
  const count = bytes.readUInt16LE(eocd + 10);
  const disk = bytes.readUInt16LE(eocd + 4);
  const total = bytes.readUInt16LE(eocd + 8);
  const dirBytes = bytes.readUInt32LE(eocd+12);
  let at = bytes.readUInt32LE(eocd+16);
  if (count > MAX_ENTRIES || !count || count !== total || disk || dirBytes > bytes.length ||
      at + dirBytes > bytes.length)
    throw new Error('XLSX arşiv başlığı güvenli değil.');

  const entries = new Map<string,ZipEntry>();
  for (let i=0;i<count;i++) {
    if (at + 46 > bytes.length || bytes.readUInt32LE(at) !== 0x02014b50)
      throw new Error('XLSX arşiv dizini bozuk.');
    const flags = bytes.readUInt16LE(at+8);
    const method = bytes.readUInt16LE(at+10);
    const crc = bytes.readUInt32LE(at+16);
    const compressed = bytes.readUInt32LE(at+20);
    const uncompressed = bytes.readUInt32LE(at+24);
    const nameLength = bytes.readUInt16LE(at+28);
    const extraLength = bytes.readUInt16LE(at+30);
    const commentLength = bytes.readUInt16LE(at+32);
    const offset = bytes.readUInt32LE(at+42);
    if ((flags & 1) || (method !== 0 && method !== 8) ||
        uncompressed > MAX_XML_BYTES || compressed > bytes.length ||
        compressed === 0 && uncompressed > 0 || offset >= bytes.length)
      throw new Error('XLSX desteklenmeyen veya güvensiz sıkıştırma içeriyor.');
    const name = bytes.toString('utf8',at+46,at+46+nameLength);
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') ||
        entries.has(name)) throw new Error('XLSX arşiv yolu geçersiz.');
    entries.set(name, {offset,compressed,uncompressed,method,crc});
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const CRC_TABLE = Uint32Array.from({length:256},(_,i) => {
  let c=i;
  for(let k=0;k<8;k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});
function crc32(bytes:Buffer):number {
  let crc=0xffffffff;
  for(const value of bytes) crc = CRC_TABLE[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function entryText(zip: Buffer, entries: Map<string,ZipEntry>, name: string): string {
  const item=entries.get(name);
  if (!item) throw new Error(`XLSX içerisinde ${name} bulunamadı.`);
  const offset=item.offset;
  if (offset+30 > zip.length || zip.readUInt32LE(offset) !== 0x04034b50)
    throw new Error('XLSX dosya başlığı bozuk.');
  const dataOffset=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28);
  const end=dataOffset+item.compressed;
  if(end>zip.length) throw new Error('XLSX dosyası eksik.');
  const compressed=zip.subarray(dataOffset,end);
  const out=item.method===0 ? compressed : inflateRawSync(compressed,{maxOutputLength:MAX_XML_BYTES});
  if(out.length!==item.uncompressed || crc32(out)!==item.crc)
    throw new Error('XLSX dosyası bozuk veya eksik.');
  const text=out.toString('utf8');
  if(/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XLSX dış XML varlıkları desteklenmiyor.');
  return text;
}

function xmlText(value:string):string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(full,entity:string) => {
    const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(entity in named) return named[entity];
    const code=entity.startsWith('#x')?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
    return Number.isFinite(code)&&code>0&&code<=0x10ffff
      ? String.fromCodePoint(code) : full;
  });
}

function attribute(tag:string,name:string):string|null {
  const safe=name.replace(/:/g,'\\:');
  const match=tag.match(new RegExp(`(?:^|\\s)${safe}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return match ? xmlText(match[1]??match[2]??'') : null;
}
function textNodes(xml:string):string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlText(m[1])).join('');
}
function columnIndex(ref:string):number {
  const match=ref.match(/^([A-Z]{1,3})\d+$/);
  if(!match) return -1;
  return [...match[1]].reduce((n,c)=>n*26+(c.charCodeAt(0)-64),0)-1;
}

export function parseXlsxFirstSheet(bytes:Buffer):string[][] {
  const entries=zipEntries(bytes);
  const workbook=entryText(bytes,entries,'xl/workbook.xml');
  const relations=entryText(bytes,entries,'xl/_rels/workbook.xml.rels');
  const sheetTag=workbook.match(/<sheet\s[^>]*\/?\s*>/);
  const relId=sheetTag ? attribute(sheetTag[0],'r:id') : null;
  if(!relId) throw new Error('XLSX çalışma sayfası bulunamadı.');
  const relation=[...relations.matchAll(/<Relationship\s[^>]*\/?\s*>/g)]
    .map(x=>x[0]).find(x=>attribute(x,'Id')===relId);
  if(!relation) throw new Error('XLSX çalışma sayfası bağlantısı eksik.');
  const target=attribute(relation,'Target');
  if(!target) throw new Error('XLSX çalışma sayfası bağlantısı eksik.');
  const relative=target.startsWith('/')?target.slice(1):'xl/'+target;
  const parts:string[]=[];
  for(const component of relative.split('/')) {
    if(component==='.'||!component) continue;
    if(component==='..') parts.pop();
    else parts.push(component);
  }
  const path=parts.join('/');
  if(!path.startsWith('xl/worksheets/')) throw new Error('XLSX yalnızca çalışma sayfası kabul eder.');
  const worksheet=entryText(bytes,entries,path);
  const shared=entries.has('xl/sharedStrings.xml')
    ? entryText(bytes,entries,'xl/sharedStrings.xml') : '';
  if(workbook.length+relations.length+worksheet.length+shared.length>MAX_WORKBOOK_XML)
    throw new Error('XLSX çalışma kitabı çok büyük.');
  const sharedStrings=[...shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map(match=>textNodes(match[1]));
  const rows:string[][]=[];
  for(const match of worksheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells:string[]=[];
    let implicit=0;
    for(const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g)) {
      const attr=cell[1],body=cell[2]??'';
      if(/<f(?:\s|>)/.test(body)) throw new Error('Excel formüllerini değer olarak kaydedip yeniden yükleyin.');
      const col=columnIndex(attribute(attr,'r')??'');
      const idx=col>=0?col:implicit;
      implicit=idx+1;
      if(idx>=MAX_COLUMNS) throw new Error('XLSX sütun sayısı çok fazla.');
      const type=attribute(attr,'t');
      const matchValue=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
      const raw=matchValue?xmlText(matchValue[1]):'';
      let value=type==='s' ? sharedStrings[Number(raw)] : type==='inlineStr' ? textNodes(body) : raw;
      if(type==='e') throw new Error('Excel formül/hücre hatası içeriyor.');
      if(value===undefined) throw new Error('XLSX metin indeksi geçersiz.');
      cells[idx]=value;
    }
    if(cells.some((cell)=>cell?.trim())) rows.push(cells.map(cell=>cell??''));
    if(rows.length>MAX_SHEET_ROWS) throw new Error('Excel dosyasında en fazla 200 ürün olabilir.');
  }
  return rows;
}
