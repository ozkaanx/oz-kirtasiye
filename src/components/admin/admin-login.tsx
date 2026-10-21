"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const supabase = createBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: admin } = await supabase.from("store_admins").select("role").eq("user_id", user?.id ?? "").maybeSingle();
      if (!admin) {
        await supabase.auth.signOut();
        setError("Bu hesap için mağaza yöneticisi yetkisi tanımlanmamış.");
        return;
      }
      router.replace("/admin/urunler");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Giriş yapılamadı.");
    } finally { setPending(false); }
  }
  return <main className="admin-login-page">
    <div className="admin-login-card">
      <Link href="/" className="admin-login-logo">öz kırtasiye<span>.</span></Link>
      <div className="admin-login-icon"><LockKeyhole size={26}/></div>
      <p className="section-eyebrow">YÖNETİM PANELİ</p>
      <h1>Tekrar hoş geldin.</h1>
      <p className="admin-login-description">Ürün, fiyat ve stoklarını güvenli şekilde yönet.</p>
      {params.get("yetki") === "yok" && <p className="admin-form-error" role="alert">Bu hesapta yönetici yetkisi bulunmuyor.</p>}
      {!hasSupabaseConfig() && <p className="admin-form-error" role="alert">Supabase bağlantısı eksik. .env.local dosyasını hazırlayın.</p>}
      <form onSubmit={onSubmit}>
        <label className="admin-field"><span><Mail size={15}/> E-posta</span><input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ornek@magaza.com"/></label>
        <label className="admin-field"><span><LockKeyhole size={15}/> Şifre</span><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <button type="submit" disabled={pending || !hasSupabaseConfig()} className="button button-primary admin-full-button">{pending ? "Giriş yapılıyor..." : "Yönetim paneline gir"}</button>
      </form>
      <p className="admin-login-footer"><ShieldCheck size={16}/> Yalnızca yetkili mağaza çalışanları</p>
    </div>
  </main>;
}
