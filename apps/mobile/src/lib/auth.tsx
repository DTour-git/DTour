import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProfileRow } from '@dtour/shared';
import { supabase } from './supabase';

interface AuthCtx {
  ready: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ ready: false, session: null, profile: null, refreshProfile: async () => {} });
export const useAuth = () => useContext(Ctx);

/** The signed-in profile; only call under the authenticated stack. */
export function useMe(): ProfileRow {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe() outside an authenticated screen');
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      load(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refreshProfile = useCallback(() => load(session), [load, session]);
  return <Ctx.Provider value={{ ready, session, profile, refreshProfile }}>{children}</Ctx.Provider>;
}
