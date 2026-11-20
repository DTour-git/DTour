import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Options for the Supabase session cookies (#42), shared by the proxy, the
 * server client and the browser client so every write sets the same flags.
 *
 * - `secure` in production builds, so the session never travels over plain
 *   http. Development stays without it: some browsers (Safari) refuse Secure
 *   cookies on http://localhost, which would break signing in to `npm run web`.
 *   Chromium accepts them on localhost, so the e2e tests (a production build
 *   on http://localhost:3100) still sign in.
 * - Not `httpOnly`: the browser client reads and refreshes the session from
 *   these cookies, so script access is required. SameSite=Lax still keeps
 *   them off cross-site requests.
 */
export const sessionCookieOptions: CookieOptionsWithName = {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
