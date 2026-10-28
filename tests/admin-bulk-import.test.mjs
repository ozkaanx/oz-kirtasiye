import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseDelimitedTable, normalizeImportTable, MAX_IMPORT_ROWS, IMPORT_TEMPLATE_CSV,
} from '../src/lib/admin-bulk-import.ts';
import { validateCostPrice } from '../src/lib/admin-catalog-validation.ts';
import { estimateProductProfit } from '../src/lib/admin-product-profit.ts';
import { parseXlsxFirstSheet } from '../src/lib/admin-xlsx.ts';

test('semicolon CSV from Turkish Excel is parsed, quoted and normalized',()=>{
  const csv='sku;ürün adı;satış fiyatı;alış maliyeti;stok;aktif;açıklama\r\n'
    +'PEN-01;"Renkli; Kalem";39,90;24,50;10;evet;"Birinci satır\nikinci satır"\r\n';
  const rows=normalizeImportTable(parseDelimitedTable(csv));
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0],{
    sku:'PEN-01',slug:'renkli-kalem-pen-01',name:'Renkli; Kalem',
    price:39.9,cost_price:24.5,stock_quantity:10,
    is_active:true,description:'Birinci satır\nikinci satır',
  });
});
test('template is Excel-compatible UTF-8 CSV and uses safe default',()=>{
  assert.ok(IMPORT_TEMPLATE_CSV.startsWith('\uFEFF'));
  const rows=normalizeImportTable(parseDelimitedTable(IMPORT_TEMPLATE_CSV));
  assert.equal(rows.length,1);
  assert.equal(rows[0].is_active,false);
});
test('CSV updates can contain only SKU plus one changed field; blank stock is omitted',()=>{
  const rows=normalizeImportTable(parseDelimitedTable('sku,price,stock_quantity\nPEN-01,34.90,\n'));
  assert.deepEqual(rows[0],{sku:'PEN-01',slug:'urun-pen-01',price:34.9});
});
test('dangerous/duplicate SKU and malformed money are rejected before hitting database',()=>{
  const invalid=[
    'sku;price\nEX-1;39,999\n',
    'sku;price\nEX-1;-2\n',
    'sku;price\nEX-1;5\nEX-1;9\n',
    'sku;name\nBAD/ID;Paper\n',
    'sku;name\nX;Paper\n',
  ];
  for(const csv of invalid)
    assert.throws(()=>normalizeImportTable(parseDelimitedTable(csv)));
  assert.throws(()=>parseDelimitedTable('sku;name\n'+
    Array.from({length:MAX_IMPORT_ROWS+1},(_,i)=>`EX-${i};Product ${i}`).join('\n')));
});
test('unbalanced CSV quotes and unsupported columns are rejected',()=>{
  assert.throws(()=>parseDelimitedTable('sku;name\nX-01;"unclosed\n'));
  assert.throws(()=>normalizeImportTable(parseDelimitedTable('sku;secret\nX-01;xx')));
  assert.throws(()=>normalizeImportTable(parseDelimitedTable('sku;name\nX-01;A')));
});
test('private cost validation and estimated margin have no hidden net-profit claim',()=>{
  assert.deepEqual(validateCostPrice('12,50'),{ok:true,value:12.5});
  assert.equal(validateCostPrice('').ok,true);
  assert.equal(validateCostPrice('-3').ok,false);
  assert.equal(validateCostPrice('1.333').ok,false);
  assert.deepEqual(estimateProductProfit(40,25),{difference:15,marginPercent:37.5});
  assert.deepEqual(estimateProductProfit(25,30),{difference:-5,marginPercent:-20});
  assert.equal(estimateProductProfit(40,null),null);
  assert.equal(estimateProductProfit(0,0)?.marginPercent,null);
});

function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {
    crc ^= byte;
    for(let bit=0;bit<8;bit++) crc = (crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1);
  }
  return (crc^0xffffffff)>>>0;
}
function makeZip(files) {
  const locals=[],centrals=[];
  let offset=0;
  for(const [name,content] of Object.entries(files)) {
    const nameBytes=Buffer.from(name),body=Buffer.from(content),crc=crc32(body);
    const l=Buffer.alloc(30),d=Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50,0);
    l.writeUInt16LE(20,4);
    l.writeUInt32LE(crc,14);
    l.writeUInt32LE(body.length,18);
    l.writeUInt32LE(body.length,22);
    l.writeUInt16LE(nameBytes.length,26);
    d.writeUInt32LE(0x02014b50,0);
    d.writeUInt16LE(20,4);
    d.writeUInt16LE(20,6);
    d.writeUInt32LE(crc,16);
    d.writeUInt32LE(body.length,20);
    d.writeUInt32LE(body.length,24);
    d.writeUInt16LE(nameBytes.length,28);
    d.writeUInt32LE(offset,42);
    locals.push(l,nameBytes,body);
    centrals.push(d,nameBytes);
    offset+=l.length+nameBytes.length+body.length;
  }
  const dir=Buffer.concat(centrals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(Object.keys(files).length,8);
  end.writeUInt16LE(Object.keys(files).length,10);
  end.writeUInt32LE(dir.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,dir,end]);
}

function sampleXlsx(sheet) {
  return makeZip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Ürünler" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<sst><si><t>sku</t></si><si><t>name</t></si><si><t>price</t></si><si><t>cost_price</t></si></sst>',
    'xl/worksheets/sheet1.xml':sheet,
  });
}
test('standard Excel XLSX shared strings and numeric cells import without another dependency',()=>{
  const sheet='<worksheet><sheetData>'+
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>'+
    '<row r="2"><c r="A2" t="inlineStr"><is><t>TEST-01</t></is></c>'+
    '<c r="B2" t="inlineStr"><is><t>A5 &amp; Defter</t></is></c>'+
    '<c r="C2"><v>49.9</v></c><c r="D2"><v>25</v></c></row>'+
    '</sheetData></worksheet>';
  const matrix=parseXlsxFirstSheet(sampleXlsx(sheet));
  assert.deepEqual(matrix[0],['sku','name','price','cost_price']);
  const rows=normalizeImportTable(matrix);
  assert.deepEqual(rows[0],{
    sku:'TEST-01',slug:'a5-defter-test-01',name:'A5 & Defter',price:49.9,cost_price:25,
  });
});
test('XLSX formulas and embedded DTD are rejected',()=>{
  const formula='<worksheet><sheetData><row><c r="A1"><f>2+2</f><v>4</v></c></row></sheetData></worksheet>';
  assert.throws(()=>parseXlsxFirstSheet(sampleXlsx(formula)),/formül/i);
  assert.throws(()=>parseXlsxFirstSheet(sampleXlsx('<!DOCTYPE worksheet><worksheet/>')),/XML|DOCTYPE/i);
});
