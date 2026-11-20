'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@dtour/shared';
import { sessionCookieOptions } from './session-cookies';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: sessionCookieOptions },
  );
  return client;
}
