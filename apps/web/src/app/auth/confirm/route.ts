import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';

// Email links (magic link / confirmation) land here with ?token_hash=…&type=…
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/';
  if (token_hash && type) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', url.origin));
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=Invalid%20link', url.origin));
}
