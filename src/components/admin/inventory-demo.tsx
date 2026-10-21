"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, Boxes, Check, ClipboardList, LayoutDashboard, Minus, Package, Plus, RefreshCcw, Search, Settings2, ShoppingBasket, X } from "lucide-react";
import { products } from "@/data/catalog";
import { formatPrice } from "@/lib/format";

type RecordEntry={id:string;productId:string;delta:number;reason:string;when:string};
type StockStore={stocks:Record<string,number>;history:RecordEntry[]};
const KEY="oz-kirtasiye-inventory-demo-v1";
const seed:Record<string,number>={p1:45,p2:18,p3:12,p4:7,p5:3,p6:36,p7:9,p8:0,p9:21,p10:43};
const initial:StockStore={stocks:seed,history:[]};

export function InventoryDemo(){
  const [store,setStore]=useState<StockStore>(initial);
  const [ready,setReady]=useState(false);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [selected,setSelected]=useState<string|null>(null);
  const [direction,setDirection]=useState<"add"|"remove">("add");
  const [amount,setAmount]=useState(1);
  const [reason,setReason]=useState("");
  const [activeTab,setActiveTab]=useState<"products"|"history">("products");
  useEffect(()=>{try{const raw=window.localStorage.getItem(KEY);if(raw){const data:unknown=JSON.parse(raw);if(data&&typeof data==="object"&&"stocks" in data&&"history" in data){const s=data as StockStore;if(s.stocks&&typeof s.stocks==="object"&&Array.isArray(s.history))setStore({stocks:{...seed,...s.stocks},history:s.history.slice(0,200)});}}}catch{}setReady(true);},[]);
  useEffect(()=>{if(ready)window.localStorage.setItem(KEY,JSON.stringify(store));},[ready,store]);
  const listed=useMemo(()=>products.filter(p=>{
    const count=store.stocks[p.id]??0;
    const q=query.trim().toLocaleLowerCase("tr-TR");
    return (!q||p.name.toLocaleLowerCase("tr-TR").includes(q))&&(filter==="all"||(filter==="low"&&count>0&&count<=10)||(filter==="zero"&&count===0)||(filter==="active"&&count>0));
  }),[store.stocks,query,filter]);
  const zero=products.filter(p=>(store.stocks[p.id]??0)===0).length;
  const low=products.filter(p=>(store.stocks[p.id]??0)>0&&(store.stocks[p.id]??0)<=10).length;
  const total=Object.values(store.stocks).reduce((sum,n)=>sum+Math.max(0,Number(n)||0),0);
  function apply(){
    if(!selected||!Number.isInteger(amount)||amount<1||amount>10000)return;
    const current=store.stocks[selected]??0;
    const change=direction==="add"?amount:-Math.min(current,amount);
    if(change===0)return;
    const entry:RecordEntry={id:`${Date.now()}-${selected}`,productId:selected,delta:change,reason:reason.trim()||(direction==="add"?"Manuel stok girişi":"Manuel stok çıkışı"),when:new Date().toISOString()};
    setStore(s=>({stocks:{...s.stocks,[selected]:(s.stocks[selected]??0)+change},history:[entry,...s.history].slice(0,200)}));
    setSelected(null);setAmount(1);setReason("");
  }
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand">öz kırtasiye<span>.</span></Link><div className="admin-sidegroup"><div className="admin-side-heading">YÖNETİM</div><Link href="/admin/stok" className="admin-side-link active"><Boxes size={18}/> Ürün ve stok</Link><button disabled className="admin-side-link"><LayoutDashboard size={18}/> Genel bakış <small>yakında</small></button><button disabled className="admin-side-link"><ShoppingBasket size={18}/> Siparişler <small>yakında</small></button><button disabled className="admin-side-link"><Settings2 size={18}/> Ayarlar <small>yakında</small></button></div><div className="admin-side-footer">Arayüz demosu · Gerçek mağaza verisi değildir.</div></aside>
  <div className="admin-main"><div className="admin-top"><Link href="/"><ArrowLeft size={16}/> Mağazaya dön</Link><span><span className="admin-online-dot"/> Yerel tasarım demosu</span></div><div className="admin-body">
    <div className="admin-banner"><AlertTriangle size={21}/><div><strong>Demo yönetim paneli</strong><p>Stok değişiklikleri yalnızca bu tarayıcıda saklanır. İnternet sitesiyle veya başka cihazlarla senkronize değildir. Gerçek kullanım için veritabanı, yetkilendirme ve sunucu işlemleri eklenecek.</p></div></div>
    <div className="admin-page-heading"><div><span className="section-eyebrow">MAĞAZA YÖNETİMİ</span><h1>Ürün ve stok yönetimi<span className="orange-dot">.</span></h1><p>Barkodsuz, kolay ve manuel stok takibi.</p></div><button className="admin-reset" type="button" onClick={()=>{if(window.confirm("Demo stokları ve işlem geçmişini başlangıç durumuna sıfırlamak istiyor musun?"))setStore(initial)}}><RefreshCcw size={16}/> Demoyu sıfırla</button></div>
    <div className="admin-stats"><div><Package size={22}/><span>Toplam ürün</span><strong>{products.length}</strong></div><div><Boxes size={22}/><span>Toplam stok adedi</span><strong>{total}</strong></div><div><AlertTriangle size={22}/><span>Stok az</span><strong>{low}</strong></div><div><Activity size={22}/><span>Stokta yok</span><strong>{zero}</strong></div></div>
    <div className="admin-content-box"><div className="admin-tabs"><button onClick={()=>setActiveTab("products")} className={activeTab==="products"?"active":""}>Ürünler ({products.length})</button><button onClick={()=>setActiveTab("history")} className={activeTab==="history"?"active":""}>İşlem geçmişi ({store.history.length})</button></div>
      {activeTab==="products"?<><div className="admin-toolbar"><div className="admin-search"><Search size={17}/><input aria-label="Stoklarda ara" placeholder="Ürün ara..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="admin-filter-pills">{[{key:"all",label:"Tümü"},{key:"active",label:"Stokta"},{key:"low",label:"Stok az"},{key:"zero",label:"Stokta yok"}].map(f=><button key={f.key} onClick={()=>setFilter(f.key)} className={filter===f.key?"active":""}>{f.label}</button>)}</div></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ÜRÜN</th><th>FİYAT</th><th>STOK</th><th>DURUM</th><th>İŞLEM</th></tr></thead><tbody>{listed.map(p=>{const count=store.stocks[p.id]??0;return <tr key={p.id}><td><div className="admin-product"><span style={{background:p.tint}}><Image src={p.image} width={50} height={50} alt=""/></span><strong>{p.name}</strong></div></td><td>{formatPrice(p.price)}</td><td><b>{count}</b> adet</td><td><span className={`admin-status ${count===0?"out":count<=10?"low":"in"}`}>{count===0?"Stokta yok":count<=10?"Stok az":"Stokta"}</span></td><td><button className="admin-edit" onClick={()=>{setSelected(p.id);setAmount(1);setDirection("add");setReason("")}}>Stok düzenle <ArrowRight size={14}/></button></td></tr>})}</tbody></table>{listed.length===0&&<div className="admin-no-results">Bu filtreye uygun ürün bulunamadı.</div>}</div></>:<div className="admin-history">{store.history.length===0?<div className="admin-no-results"><ClipboardList size={35}/><h3>Henüz stok işlemi yok</h3><p>Bir ürünün stoğunu düzenlediğinde işlemi burada görebilirsin.</p></div>:store.history.map(row=>{const p=products.find(p=>p.id===row.productId);return <div key={row.id}><span className={`history-sign ${row.delta>0?"positive":"negative"}`}>{row.delta>0?<Plus size={17}/>:<Minus size={17}/>}</span><div><strong>{p?.name??"Ürün"}</strong><small>{row.reason} · {new Date(row.when).toLocaleString("tr-TR")}</small></div><b className={row.delta>0?"plus-text":"minus-text"}>{row.delta>0?"+":""}{row.delta}</b></div>})}</div>}
    </div></div>
  </div>
  {selected&&(()=>{const p=products.find(p=>p.id===selected);if(!p)return null;const count=store.stocks[selected]??0;return <div className="admin-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="admin-modal" role="dialog" aria-modal="true" aria-label="Stok düzenle"><div className="admin-modal-heading"><h2>Stok düzenle</h2><button onClick={()=>setSelected(null)} aria-label="Kapat"><X size={20}/></button></div><div className="admin-modal-product"><div style={{background:p.tint}}><Image src={p.image} alt="" width={84} height={84}/></div><span><b>{p.name}</b><small>Mevcut stok: {count} adet</small></span></div><div className="stock-switch"><button className={direction==="add"?"active":""} onClick={()=>setDirection("add")}><Plus size={17}/> Stok artır</button><button className={direction==="remove"?"active":""} onClick={()=>setDirection("remove")}><Minus size={17}/> Stok azalt</button></div><label className="admin-field">{direction==="add"?"Eklenecek miktar":"Azaltılacak miktar"}<input type="number" min="1" max={direction==="remove"?count:10000} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label className="admin-field">Açıklama (isteğe bağlı)<input value={reason} maxLength={90} onChange={e=>setReason(e.target.value)} placeholder={direction==="add"?"Yeni ürün alımı":"Fiziksel mağaza satışı"}/></label><div className="admin-prediction">İşlem sonrası stok <strong>{Math.max(0,count+(direction==="add"?amount:-amount))} adet</strong></div><button className="button button-primary" disabled={amount<1||!Number.isInteger(amount)||(direction==="remove"&&amount>count)||amount>10000} onClick={apply}><Check size={19}/> Stok değişikliğini kaydet</button></div></div>})()}
  </div>;
}
