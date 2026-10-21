import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AdminLogin } from '@/components/admin/admin-login';
export const metadata: Metadata = {
  title: 'Yönetici Girişi',
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>Yükleniyor...</p>}>
      <AdminLogin />
    </Suspense>
  );
}
