import Link from 'next/link';
import { Search } from 'lucide-react';
import { ORDER_STATUS_LABELS } from '@/lib/admin-orders';
import type { OrderSearch } from '@/lib/admin-order-search';
import styles from './admin-list-filters.module.css';

export function OrderSearchFilters({ search }: { search: OrderSearch }) {
  return (
    <form action="/admin/siparisler" method="get">
      <div className="order-filter-bar">
        <label className="admin-filter-label">
          Durum
          <select name="status" defaultValue={search.status}>
            <option value="all">Tüm siparişler</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="order-search">
          <Search size={16} />
          <input
            name="q"
            defaultValue={search.q}
            maxLength={100}
            aria-label="Sipariş numarası, müşteri veya telefon ara"
            placeholder="Sipariş no, müşteri veya telefon"
          />
        </label>
      </div>
      <div className={styles.filters}>
        <label className={styles.field}>
          Teslimat şekli
          <select name="delivery" defaultValue={search.delivery}>
            <option value="all">Tüm teslimatlar</option>
            <option value="shipping">Kargo ile</option>
            <option value="pickup">Mağazadan teslim</option>
            <option value="legacy">Eski kayıtlar</option>
          </select>
        </label>
        <label className={styles.field}>
          Başlangıç tarihi
          <input type="date" name="from" defaultValue={search.from} />
        </label>
        <label className={styles.field}>
          Bitiş tarihi
          <input type="date" name="to" defaultValue={search.to} />
        </label>
        <button type="submit" className={styles.reset}>
          Ara / Filtrele
        </button>
        <Link href="/admin/siparisler" className={styles.reset}>
          Filtreleri temizle
        </Link>
      </div>
    </form>
  );
}
