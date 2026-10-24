import type { Metadata } from 'next';
import { CustomerAuthForm } from '@/components/account/customer-auth-form';

export const metadata: Metadata = {
  title: 'Şifremi Unuttum',
  robots: { index: false, follow: false },
};
export default function ForgotPage() {
  return <CustomerAuthForm mode="forgot" />;
}
