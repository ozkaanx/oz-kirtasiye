'use client';
import { useEffect, useState } from 'react';
type Target = { id: string; name: string; sku?: string | null };
type Result = {
  key: string;
  rows: Target[];
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  error?: string;
};

export function CampaignProductPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Target | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${query}:${page}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, page: String(page) });
        const response = await fetch('/api/admin/campaign-products?' + params, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.rows))
          throw new Error(body.message ?? 'Ürünler yüklenemedi.');
        if (!controller.signal.aborted) setResult({ ...body, key });
      } catch (cause) {
        if (!controller.signal.aborted)
          setResult({
            key,
            rows: [],
            page,
            hasNext: false,
            hasPrevious: false,
            error: cause instanceof Error ? cause.message : 'Ürünler yüklenemedi.',
          });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, key, retry]);
  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? [];
  return (
    <div className="campaign-product-picker">
      <label>
        Ürün adı veya koduyla ara
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Tüm katalogda ara"
        />
      </label>
      {current?.error ? (
        <p role="alert">
          {current.error}{' '}
          <button type="button" onClick={() => setRetry((x) => x + 1)}>
            Tekrar dene
          </button>
        </p>
      ) : (
        <>
          {!current && <p role="status">Ürünler yükleniyor…</p>}
          <label>
            Ürün
            <select
              required
              value={value}
              onChange={(e) => {
                const found = rows.find((row) => row.id === e.target.value) ?? null;
                setSelected(found);
                onChange(e.target.value);
              }}
            >
              <option value="">Seçiniz</option>
              {selected && selected.id === value && !rows.some((row) => row.id === value) && (
                <option value={value}>{selected.name}</option>
              )}
              {rows.map((row) => (
                <option value={row.id} key={row.id}>
                  {row.name}
                  {row.sku ? ` (${row.sku})` : ''}
                </option>
              ))}
            </select>
          </label>
          {current && !rows.length && <p role="status">Ürün bulunamadı.</p>}
          <div className="admin-action-group" aria-label="Ürün seçim sayfaları">
            <button
              type="button"
              disabled={!current?.hasPrevious}
              onClick={() => setPage(current!.page - 1)}
            >
              Önceki
            </button>
            <span>Sayfa {current?.page ?? page}</span>
            <button
              type="button"
              disabled={!current?.hasNext}
              onClick={() => setPage(current!.page + 1)}
            >
              Sonraki
            </button>
          </div>
        </>
      )}
    </div>
  );
}
