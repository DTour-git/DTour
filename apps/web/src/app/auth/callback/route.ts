import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth-next';
import { loginErrorCode, loginErrorUrl } from '@/lib/login-error';
import { supabaseServer } from '@/lib/supabase-server';

// Google OAuth (PKCE) lands here with ?code=…
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const error = url.searchParams.get('error');
  const description = url.searchParams.get('error_description');
  if (error || description) {
    const reason = loginErrorCode({ error, code: url.searchParams.get('error_code'), message: description });
    return NextResponse.redirect(loginErrorUrl(url.origin, reason));
  }
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(loginErrorUrl(url.origin, loginErrorCode(error)));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
