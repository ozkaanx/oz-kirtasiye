'use client';

import Link from 'next/link';

export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <div className="admin-body">
      <section className="admin-content-box" role="alert">
        <h1>Bilgiler yüklenemedi</h1>
        <p>Bağlantını kontrol edip tekrar dene. Formu açmadan önce kayıtlı bilgiler yüklenecek.</p>
        <button type="button" className="button button-primary" onClick={() => retry()}>
          Tekrar dene
        </button>
        <Link href="/admin/genel-bakis" className="button button-outline">
          Genel bakışa dön
        </Link>
      </section>
    </div>
  );
}
