import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'E-posta bildirimleri', robots: { index: false, follow: false } };

export default async function OrderEmailPage() {
  const client = await createServerSupabase();
  const { data, error } = await client.rpc('admin_order_email_summary');
  if (error || !data) throw new Error('E-posta durumu yüklenemedi.');
  const summary = data as { enabled: boolean; pending: number; sent: number; failed: number };
  return (
    <div className="admin-body">
      <div className="admin-page-heading">
        <div>
          <h1>E-posta bildirimleri</h1>
          <p>Sipariş alındı ve kargoya verildi bildirimleri.</p>
        </div>
      </div>
      <section className="admin-content-box">
        <h2>{summary.enabled ? 'Gönderim açık' : 'Gönderim kapalı'}</h2>
        <p>
          Bildirimler e-posta adresini doğrulamış üyeler için oluşturulur. Misafir siparişlerinde
          e-posta adresi toplanmaz.
        </p>
        <dl>
          <dt>Bekleyen</dt>
          <dd>{summary.pending}</dd>
          <dt>Gönderim hizmetinin kabul ettiği</dt>
          <dd>{summary.sent}</dd>
          <dt>İnceleme gereken</dt>
          <dd>{summary.failed}</dd>
        </dl>
        <p>
          Kabul edilen gönderim, e-postanın gelen kutusuna ulaştığını garanti etmez. Teslim ve geri
          dönüş durumlarını Resend panelinden kontrol et.
        </p>
        {summary.failed > 0 && (
          <p role="alert">
            Başarısız gönderimler var. Resend ve gönderim kayıtlarını kontrol et; aynı e-postayı
            elle tekrar göndermeden önce ilk gönderimin durumunu doğrula.
          </p>
        )}
        <Link href="/admin/siparisler" className="button button-outline">
          Siparişlere dön
        </Link>
      </section>
    </div>
  );
}
