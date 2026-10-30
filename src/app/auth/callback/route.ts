import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { completeCustomerAuthCallback } from '@/lib/customer-auth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  let destination = '/giris?error=dogrulama';
  try {
    const supabase = await createServerSupabase();
    destination = await completeCustomerAuthCallback(url.searchParams, supabase.auth);
  } catch {
    // Keep setup/network failures out of public callback responses.
  }
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
