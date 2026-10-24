import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/hesabim';
  // Redirect to fixed same-origin routes; don't permit open redirects.
  const destination = next === '/sifre-yenile' ? '/sifre-yenile' : '/hesabim';
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const supabase = await createServerSupabase();
  let success = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    success = !error;
  } else if (tokenHash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    success = !error;
  }
  return NextResponse.redirect(
    new URL(success ? destination : '/giris?error=dogrulama', url.origin),
  );
}
