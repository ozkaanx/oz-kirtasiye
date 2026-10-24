import type { Metadata } from 'next';
import { CustomerAuthForm } from '@/components/account/customer-auth-form';

export const metadata: Metadata = { title: 'Giriş Yap', robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <CustomerAuthForm mode="login" nextPath={next} errorCode={error} />;
}
