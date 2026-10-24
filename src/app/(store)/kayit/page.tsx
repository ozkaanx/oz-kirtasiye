import type { Metadata } from 'next';
import { CustomerAuthForm } from '@/components/account/customer-auth-form';

export const metadata: Metadata = { title: 'Üye Ol', robots: { index: false, follow: false } };
export default function RegisterPage() {
  return <CustomerAuthForm mode="register" />;
}
