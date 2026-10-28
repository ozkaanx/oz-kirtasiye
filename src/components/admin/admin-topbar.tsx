'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export function AdminTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const back =
    pathname === '/admin/kategoriler' || pathname.endsWith('/varyantlar')
      ? { href: '/admin/urunler', label: 'Ürün yönetimine dön' }
      : pathname === '/admin/raporlar'
        ? { href: '/admin/genel-bakis', label: 'Genel bakışa dön' }
        : { href: '/', label: 'Mağazaya dön' };

  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const { error: signOutError } = await createBrowserSupabase().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/admin/giris');
      router.refresh();
    } catch {
      setError('Çıkış yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <header className="admin-top">
        <Link href={back.href}>
          <ArrowLeft size={16} aria-hidden="true" /> {back.label}
        </Link>
        <button
          type="button"
          className="admin-logout"
          disabled={pending}
          onClick={() => void logout()}
        >
          <LogOut size={16} aria-hidden="true" /> {pending ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
        </button>
      </header>
      {error && (
        <p role="alert" className="admin-form-error">
          {error}
        </p>
      )}
    </>
  );
}
