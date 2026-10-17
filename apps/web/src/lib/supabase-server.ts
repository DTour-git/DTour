import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { getMe, type Database } from '@dtour/shared';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
          catch { /* called from a Server Component — the proxy refreshes the session */ }
        },
      },
    },
  );
}

/** Current user + profile, memoised per request. */
export const currentUser = cache(async () => {
  const sb = await supabaseServer();
  return { sb, me: await getMe(sb) };
});
