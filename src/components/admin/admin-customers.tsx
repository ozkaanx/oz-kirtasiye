'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Search, ShoppingBag, Repeat2, TicketPercent } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { formatPrice } from '@/lib/format';
import styles from './admin-customers.module.css';

export type CrmOrder = { id: string; userId: string; name: string; phone: string; reference: string; status: string; total: number; createdAt: string };
type Customer = { userId: string; name: string; phone: string; orders: CrmOrder[]; count: number; requestedTotal: number; latest: string };
const date = (v: string) => new Date(v).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
export function AdminCustomers({ orders, error, capped }: { orders: CrmOrder[]; error: string | null; capped: boolean }) {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('all');
  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const order of orders) {
      const item = map.get(order.userId) ?? { userId: order.userId, name: order.name, phone: order.phone, orders: [], count: 0, requestedTotal: 0, latest: order.createdAt };
      item.orders.push(order);
      if (order.status !== 'cancelled') { item.count++; item.requestedTotal += order.total; }
      map.set(order.userId, item);
    }
    return [...map.values()].sort((a,b) => b.latest.localeCompare(a.latest));
  }, [orders]);
  const filtered = customers.filter(c => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q && !`${c.name} ${c.phone} ${c.userId}`.toLocaleLowerCase('tr-TR').includes(q)) return false;
    if (segment === 'repeat') return c.count >= 2;
    if (segment === 'single') return c.count === 1;
    if (segment === 'cancelled') return c.count === 0;
    return true;
  });
  return <div className="admin-shell"><AdminSidebar /><main className="admin-main"><div className="admin-body">
    <header className="admin-page-heading"><div><span className="section-eyebrow">ÖZ KIRTASİYE · CRM</span><h1>Müşteriler<span className="orange-dot">.</span></h1><p>Üye hesabıyla sipariş vermiş müşterilerin geçmişini ve tekrar alışveriş eğilimlerini incele.</p></div></header>
    {error && <p role="alert" className="admin-form-error">Veriler yüklenemedi: {error}</p>}
    {capped && <p role="status" className="admin-form-error">Son 2.000 sipariş yüklenmiştir; eski siparişler bu rapora dahil değildir.</p>}
    <div className={styles.metrics}>
      <article><Users size={22}/><span>Sipariş veren üyeler</span><strong>{customers.length}</strong></article>
      <article><ShoppingBag size={22}/><span>İptal edilmemiş talepler</span><strong>{customers.reduce((s,c)=>s+c.count,0)}</strong></article>
      <article><Repeat2 size={22}/><span>Tekrar sipariş veren</span><strong>{customers.filter(c=>c.count>=2).length}</strong></article>
      <article><TicketPercent size={22}/><span>Sipariş talep değeri</span><strong>{formatPrice(customers.reduce((s,c)=>s+c.requestedTotal,0))}</strong></article>
    </div>
    <p className={styles.notice}>Tutarlar ödeme tahsilatı veya ciro değil, iptal edilmemiş sipariş taleplerinin değeridir. Misafir siparişleri ve hiç sipariş vermeyen üyeler listelenmez.</p>
    <div className={styles.filters}><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Müşteri adı, telefon veya üye kimliği" aria-label="Müşteri ara" /></label><select value={segment} onChange={e=>setSegment(e.target.value)} aria-label="Müşteri segmenti"><option value="all">Tüm müşteriler</option><option value="repeat">Tekrar sipariş veren</option><option value="single">Tek sipariş veren</option><option value="cancelled">Yalnızca iptal edilen</option></select></div>
    <div className={styles.list}>
      {filtered.length===0 && <p>Bu filtrede müşteri bulunamadı.</p>}
      {filtered.map(c=><Link key={c.userId} href={`/admin/musteriler/${c.userId}`} className={styles.customer}>
        <span><strong>{c.name||'İsimsiz müşteri'}</strong><small>{c.phone} · Son talep: {date(c.latest)}</small></span>
        <span className={styles.right}><b>{c.count} talep</b><small>{formatPrice(c.requestedTotal)}</small><small>Detayları görüntüle →</small></span>
      </Link>)}
    </div>
  </div></main></div>;
}
