'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import styles from './customer-account.module.css';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
type Props = { mode: Mode; nextPath?: string; errorCode?: string };

function safeNext(path?: string): string {
  return path &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !path.includes('\n')
    ? path
    : '/hesabim';
}

export function CustomerAuthForm({ mode, nextPath, errorCode }: Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    errorCode === 'dogrulama' ? 'Bağlantı geçersiz veya süresi dolmuş. Tekrar deneyin.' : '',
  );
  const [success, setSuccess] = useState('');

  const heading = {
    login: 'Tekrar hoş geldin',
    register: 'Aramıza katıl',
    forgot: 'Şifreni sıfırla',
    reset: 'Yeni şifreni belirle',
  }[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError)
          throw new Error(
            'E-posta veya şifre hatalı. Hesabın doğrulama bekliyorsa e-postanı kontrol et.',
          );
        router.replace(safeNext(nextPath));
        router.refresh();
      } else if (mode === 'register') {
        if (name.trim().length < 3 || name.trim().length > 100)
          throw new Error('Ad soyad 3–100 karakter olmalı.');
        if (password.length < 8) throw new Error('Şifren en az 8 karakter olmalı.');
        if (password !== confirmPassword) throw new Error('Şifreler uyuşmuyor.');
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/hesabim`,
          },
        });
        if (authError) throw new Error(authError.message);
        if (data.session) {
          router.replace('/hesabim');
          router.refresh();
        } else {
          setSuccess(
            'Üyelik isteğin alındı. Supabase Auth e-posta doğrulaması açıksa gelen bağlantıyla hesabını doğrulaman gerekiyor.',
          );
        }
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/sifre-yenile`,
        });
        if (authError) throw new Error(authError.message);
        setSuccess(
          'Hesap kayıtlıysa şifre sıfırlama bağlantısı gönderilir. Bu özellik Supabase Auth e-posta gönderiminin açık olmasına bağlıdır.',
        );
      } else {
        if (password.length < 8) throw new Error('Yeni şifren en az 8 karakter olmalı.');
        if (password !== confirmPassword) throw new Error('Şifreler uyuşmuyor.');
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user)
          throw new Error('Sıfırlama bağlantısını e-postandan açmalısın.');
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw new Error(authError.message);
        setSuccess('Şifren yenilendi. Hesabına yönlendiriliyorsun.');
        router.replace('/hesabim');
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem gerçekleştirilemedi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`container-wide ${styles.authPage}`}>
      <div className={styles.authAside}>
        <span className="section-eyebrow">ÖZ KIRTASİYE</span>
        <h1>
          Alışverişin daha <em>kolay</em> olsun<span className="orange-dot">.</span>
        </h1>
        <p>
          Adreslerini kaydet, siparişlerini tek yerden takip et. Üye olmak istemiyorsan misafir
          alışverişine devam edebilirsin.
        </p>
        <div className={styles.authDecor}>✏️ &nbsp; 📘 &nbsp; 🎨</div>
      </div>
      <div className={styles.authCard}>
        <span className={styles.authIcon}>
          <UserRound size={24} />
        </span>
        <h2>{heading}</h2>
        <p className={styles.subtle}>
          {mode === 'login'
            ? 'Öz Kırtasiye hesabına giriş yap.'
            : mode === 'register'
              ? 'Hesabını güvenle oluştur.'
              : mode === 'forgot'
                ? 'Kayıtlı e-posta adresini gir.'
                : 'Güvenli yeni şifreni yaz.'}
        </p>
        <form onSubmit={submit} className={styles.form}>
          {mode === 'register' && (
            <label>
              Ad soyad
              <input
                autoComplete="name"
                required
                minLength={3}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız Soyadınız"
              />
            </label>
          )}
          {mode !== 'reset' && (
            <label>
              E-posta
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@eposta.com"
              />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>
              {mode === 'reset' ? 'Yeni şifre' : 'Şifre'}
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'login' ? 1 : 8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}
          {(mode === 'register' || mode === 'reset') && (
            <label>
              Şifre tekrar
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {success && (
            <p role="status" className={styles.success}>
              {success}
            </p>
          )}
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending
              ? 'İşleniyor...'
              : mode === 'login'
                ? 'Giriş yap'
                : mode === 'register'
                  ? 'Üye ol'
                  : mode === 'forgot'
                    ? 'Sıfırlama bağlantısı gönder'
                    : 'Şifreyi güncelle'}{' '}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className={styles.authLinks}>
          {mode === 'login' && (
            <>
              <Link href="/sifremi-unuttum">Şifremi unuttum</Link>
              <Link href="/kayit">Hesabın yok mu? Üye ol</Link>
            </>
          )}
          {mode === 'register' && <Link href="/giris">Zaten üye misin? Giriş yap</Link>}
          {(mode === 'forgot' || mode === 'reset') && <Link href="/giris">Giriş ekranına dön</Link>}
          <Link href="/urunler">Üye olmadan alışveriş yap</Link>
        </div>
        <p className={styles.safeNote}>
          <ShieldCheck size={15} /> Güvenli oturum: Supabase Auth. <Mail size={15} /> Doğrulama ve
          şifre sıfırlama bağlantıları için Auth e-postası gerekebilir.
        </p>
      </div>
    </section>
  );
}
