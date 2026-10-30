export type CustomerAuthMode = 'login' | 'register' | 'forgot' | 'reset';

/** Reject browser-normalized protocol-relative URLs and control characters. */
export function safeCustomerNext(path?: string): string {
  if (!path?.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(path)) {
    return '/hesabim';
  }
  try {
    const base = 'https://store.invalid';
    const url = new URL(path, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : '/hesabim';
  } catch {
    return '/hesabim';
  }
}

export function customerAuthError(
  error: { code?: string; status?: number },
  mode: CustomerAuthMode,
): string {
  if (
    error.status === 429 ||
    ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code ?? '')
  ) {
    return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  }
  if (error.code === 'email_not_confirmed')
    return 'Giriş yapmadan önce e-postandaki bağlantıyla hesabını doğrula.';
  if (error.code === 'same_password') return 'Yeni şifren önceki şifrenden farklı olmalı.';
  if (error.code === 'weak_password') return 'Daha güçlü bir şifre seç. En az 8 karakter kullan.';
  if (mode === 'login') return 'E-posta veya şifre hatalı. Bilgilerini kontrol edip tekrar dene.';
  return 'İşlem şu anda tamamlanamıyor. Biraz sonra tekrar dene.';
}

type CallbackAuth = {
  exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>;
  verifyOtp: (input: {
    token_hash: string;
    type: 'signup' | 'recovery' | 'email';
  }) => Promise<{ error: unknown }>;
};

/** Only fixed local destinations; callback secrets are never returned or logged. */
export async function completeCustomerAuthCallback(
  params: URLSearchParams,
  auth: CallbackAuth,
): Promise<string> {
  const failure = '/giris?error=dogrulama';
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (params.has('error') || (code && tokenHash)) return failure;
  try {
    if (code) {
      if ((await auth.exchangeCodeForSession(code)).error) return failure;
    } else if (tokenHash && (type === 'signup' || type === 'recovery' || type === 'email')) {
      if ((await auth.verifyOtp({ token_hash: tokenHash, type })).error) return failure;
    } else {
      return failure;
    }
    return type === 'recovery' || params.get('next') === '/sifre-yenile'
      ? '/sifre-yenile'
      : '/hesabim';
  } catch {
    return failure;
  }
}
