import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { safeNext } from '@/lib/auth-next';
import { loginErrorCode, loginErrorUrl } from '@/lib/login-error';
import { supabaseServer } from '@/lib/supabase-server';

// Email links (magic link / confirmation) land here with ?token_hash=…&type=…
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(url.searchParams.get('next'));
  if (token_hash && type) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(loginErrorUrl(url.origin, loginErrorCode(error)));
  }
  return NextResponse.redirect(loginErrorUrl(url.origin, 'link_expired'));
}
