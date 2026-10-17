import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Google OAuth (PKCE) lands here with ?code=…
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const err = url.searchParams.get('error_description');
  if (err) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err)}`, url.origin));
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

function safeNext(n: string | null) {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}
