'use client';

import Link from 'next/link';

export default function StoreError({ retry }: { retry: () => void }) {
  return (
    <section className="container-wide section-space" role="alert">
      <h1>Bu sayfa şu anda yüklenemiyor</h1>
      <p>Lütfen biraz sonra tekrar dene.</p>
      <button type="button" className="button button-primary" onClick={() => retry()}>
        Tekrar dene
      </button>
      <Link href="/" className="button button-outline">
        Ana sayfaya dön
      </Link>
    </section>
  );
}
