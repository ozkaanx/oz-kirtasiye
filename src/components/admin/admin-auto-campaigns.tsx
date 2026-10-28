'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { useClock } from '@/lib/use-clock';
import { useRouter } from 'next/navigation';
import { Megaphone, PlusCircle, ShieldCheck } from 'lucide-react';

import { createBrowserSupabase } from '@/lib/supabase/browser';
import { formatPrice } from '@/lib/format';
import styles from './admin-coupons.module.css';

type Scope = 'order' | 'category' | 'product';
type DiscountType = 'percent' | 'fixed';
export type AutoCampaign = {
  id: string;
  name: string;
  scope: Scope;
  category_id: string | null;
  product_id: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount: number | null;
  min_subtotal: number;
  starts_at: string;
  expires_at: string | null;
  priority: number;
  is_active: boolean;
};
export type Target = { id: string; name: string };
const showDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Süresiz';

export function AdminAutoCampaigns({
  campaigns,
  categories,
  products,
  loadError,
}: {
  campaigns: AutoCampaign[];
  categories: Target[];
  products: Target[];
  loadError: string | null;
}) {
  const router = useRouter();
  const now = useClock();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<Scope>('category');
  const [target, setTarget] = useState('');
  const [type, setType] = useState<DiscountType>('percent');
  const [value, setValue] = useState('15');
  const [min, setMin] = useState('0');
  const [cap, setCap] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [priority, setPriority] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const options = scope === 'category' ? categories : products;
  const visible = useMemo(
    () =>
      campaigns.filter((c) =>
        c.name.toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR')),
      ),
    [campaigns, search],
  );
  const targetName = (c: AutoCampaign) =>
    c.scope === 'order'
      ? 'Tüm sepet'
      : ((c.scope === 'category'
          ? categories.find((t) => t.id === c.category_id)?.name
          : products.find((t) => t.id === c.product_id)?.name) ?? 'Bilinmiyor');

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setMessage('');
    const num = Number(value),
      floor = Number(min),
      ceiling = cap ? Number(cap) : null,
      rank = Number(priority);
    if (
      name.trim().length < 3 ||
      name.trim().length > 100 ||
      (scope !== 'order' && !options.some((t) => t.id === target))
    ) {
      setError('Kampanya adı ve hedef seçimini kontrol et.');
      return;
    }
    if (
      !Number.isFinite(num) ||
      num <= 0 ||
      (type === 'percent' && num > 100) ||
      !Number.isFinite(floor) ||
      floor < 0 ||
      (ceiling !== null && (!Number.isFinite(ceiling) || ceiling <= 0)) ||
      !Number.isInteger(rank) ||
      rank < 0 ||
      rank > 100
    ) {
      setError('İndirim ve sınırları kontrol et.');
      return;
    }
    if (end && new Date(end).getTime() <= (start ? new Date(start).getTime() : Date.now())) {
      setError('Bitiş, başlangıç zamanından sonra olmalı.');
      return;
    }
    setBusy(true);
    try {
      const db = createBrowserSupabase();
      const { data: auth } = await db.auth.getUser();
      const { error: dbError } = await db.from('automatic_campaigns').insert({
        name: name.trim(),
        scope,
        category_id: scope === 'category' ? target : null,
        product_id: scope === 'product' ? target : null,
        discount_type: type,
        discount_value: num,
        max_discount: type === 'percent' ? ceiling : null,
        min_subtotal: floor,
        priority: rank,
        starts_at: start ? new Date(start).toISOString() : new Date().toISOString(),
        expires_at: end ? new Date(end).toISOString() : null,
        created_by: auth.user?.id ?? null,
      });
      if (dbError) throw dbError;
      setMessage(`${name.trim()} kampanyası oluşturuldu.`);
      setName('');
      setTarget('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kampanya kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }
  async function toggle(c: AutoCampaign) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: dbError } = await createBrowserSupabase()
        .from('automatic_campaigns')
        .update({ is_active: !c.is_active })
        .eq('id', c.id);
      if (dbError) throw dbError;
      setMessage(`${c.name}: ${c.is_active ? 'durduruldu' : 'etkinleştirildi'}.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Durum güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-body">
      <div className="admin-page-heading">
        <div>
          <span className="section-eyebrow">ÖZ KIRTASİYE · KAMPANYALAR</span>
          <h1>
            Otomatik kampanyalar<span className="orange-dot">.</span>
          </h1>
          <p>Kupon kodu gerektirmeyen ürün, kategori ve sepet indirimleri.</p>
        </div>
      </div>
      <div className={styles.notice}>
        <ShieldCheck size={19} />
        <span>
          <strong>Çift indirim yok.</strong> Kuponla veya başka kampanyayla çakışırsa en yüksek
          indirim seçilir. Kategori kampanyaları alt kategorileri de kapsar. Bu ekran ödeme tahsil
          etmez.
        </span>
      </div>
      {loadError && (
        <p className={styles.error} role="alert">
          Kampanyalar yüklenemedi: {loadError}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      <div className={styles.layout}>
        <section className={styles.panel}>
          <h2>
            <PlusCircle size={19} /> Yeni kampanya
          </h2>
          <form className={styles.form} onSubmit={(e) => void create(e)}>
            <label>
              Kampanya adı
              <input
                required
                minLength={3}
                maxLength={100}
                placeholder="Defterlerde %15 indirim"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className={styles.two}>
              <label>
                Kapsam
                <select
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as Scope);
                    setTarget('');
                  }}
                >
                  <option value="category">Kategori</option>
                  <option value="product">Ürün</option>
                  <option value="order">Tüm sepet</option>
                </select>
              </label>
              {scope !== 'order' && (
                <label>
                  {scope === 'category' ? 'Kategori' : 'Ürün'}
                  <select required value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">Seçiniz</option>
                    {options.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className={styles.two}>
              <label>
                İndirim
                <select value={type} onChange={(e) => setType(e.target.value as DiscountType)}>
                  <option value="percent">Yüzde (%)</option>
                  <option value="fixed">Sabit TL</option>
                </select>
              </label>
              <label>
                Değer
                <input
                  required
                  type="number"
                  min="0.01"
                  max={type === 'percent' ? 100 : 999999.99}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.two}>
              <label>
                Min. sepet ürün tutarı (TL)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                />
              </label>
              <label>
                Maks. indirim (TL)<small>Yalnızca yüzde için</small>
                <input
                  disabled={type === 'fixed'}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={cap}
                  placeholder="Sınırsız"
                  onChange={(e) => setCap(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.two}>
              <label>
                Başlangıç
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Bitiş (isteğe bağlı)
                <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <label>
              Öncelik (eşit indirimde)
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </label>
            <button className={styles.primary} type="submit" disabled={busy}>
              {busy ? 'Kaydediliyor...' : 'Kampanya oluştur'}
            </button>
          </form>
        </section>
        <section className={styles.panel}>
          <div className={styles.heading}>
            <h2>
              <Megaphone size={19} /> Kampanya listesi
            </h2>
            <strong>{campaigns.length} kampanya</strong>
          </div>
          <input
            className={styles.search}
            aria-label="Kampanya ara"
            placeholder="Kampanya ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.stack}>
            {visible.length === 0 && <p className={styles.empty}>Kampanya bulunamadı.</p>}
            {visible.map((c) => {
              const expired = !!c.expires_at && new Date(c.expires_at).getTime() <= now;
              const future = new Date(c.starts_at).getTime() > now;
              const active = c.is_active && !expired && !future;
              return (
                <article key={c.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <strong>{c.name}</strong>
                    <span className={styles.tag} data-active={active}>
                      {!c.is_active
                        ? 'Durduruldu'
                        : expired
                          ? 'Süresi doldu'
                          : future
                            ? 'Başlayacak'
                            : 'Aktif'}
                    </span>
                  </div>
                  <p>{targetName(c)}</p>
                  <div className={styles.grid}>
                    <span>
                      İndirim
                      <strong>
                        {c.discount_type === 'percent'
                          ? `%${c.discount_value}`
                          : formatPrice(c.discount_value)}
                      </strong>
                    </span>
                    <span>
                      Min. sepet<strong>{formatPrice(c.min_subtotal)}</strong>
                    </span>
                    <span>
                      Başlangıç<strong>{showDate(c.starts_at)}</strong>
                    </span>
                    <span>
                      Bitiş<strong>{showDate(c.expires_at)}</strong>
                    </span>
                    <span>
                      Öncelik<strong>{c.priority}</strong>
                    </span>
                    <span>
                      Üst sınır
                      <strong>
                        {c.max_discount === null ? 'Yok' : formatPrice(c.max_discount)}
                      </strong>
                    </span>
                  </div>
                  <button
                    className={styles.toggle}
                    type="button"
                    disabled={busy}
                    onClick={() => void toggle(c)}
                  >
                    {c.is_active ? 'Kampanyayı durdur' : 'Yeniden etkinleştir'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
