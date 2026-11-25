import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { sessionCookieOptions } from '@/lib/session-cookies';

// Reading is public; only these need an account (writes are also guarded in the UI and by RLS).
const MEMBERS_ONLY = ['/new', '/onboarding', '/mod'];

// Refreshes the Supabase session cookie on every request and sends visitors
// to /login only for member pages.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const path = request.nextUrl.pathname;
  const membersOnly = MEMBERS_ONLY.some((p) => path.startsWith(p));
  // Members-only pages ask the Auth server (getUser), so a revoked session is refused at once; elsewhere
  // getClaims() verifies the JWT locally. Both refresh an expired session. See AGENTS.md "Session freshness".
  const signedIn = membersOnly ? !!(await sb.auth.getUser()).data.user : !!(await sb.auth.getClaims()).data?.claims;
  if (!signedIn && membersOnly) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    // Keep any cookie the Auth client just cleared or refreshed (a revoked session's dead cookie).
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|.*\\.(?:png|jpg|svg|webp|ico)$).*)'],
};
