import type { Metadata } from 'next';
import { CustomerAuthForm } from '@/components/account/customer-auth-form';

export const metadata: Metadata = { title: 'Yeni Şifre', robots: { index: false, follow: false } };
export default function ResetPasswordPage() {
  return <CustomerAuthForm mode="reset" />;
}
