import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { getMySuspension, suspensionText, type ProfileRow } from '@dtour/shared';
import { supabase } from './supabase';
import { unregisterPush } from './push';
import { setMonitoringUser } from './monitoring';

interface AuthCtx {
  ready: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  /** My active suspension (#64), if a moderator stopped me writing. */
  suspension: { reason: string; ends_at: string | null } | null;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ ready: false, session: null, profile: null, suspension: null, refreshProfile: async () => {} });
export const useAuth = () => useContext(Ctx);

/**
 * Signs out of this device. The push registration goes first, while the session
 * can still delete it, so the phone stops getting this student's notifications (#44).
 */
export async function signOut(options?: Parameters<typeof supabase.auth.signOut>[0]) {
  await unregisterPush().catch(() => {});
  await supabase.auth.signOut(options);
}

/** The signed-in profile, or null for a visitor browsing without an account. */
export function useMe(): ProfileRow | null {
  return useAuth().profile;
}

/**
 * Returns a guard for write actions: the profile, or opens sign-in and returns null.
 * A suspended member (#64) sees the reason and end date instead, unless the write is
 * `'own'` housekeeping (saves, downloads) that a suspension still allows.
 */
export function useRequireMe() {
  const { profile, suspension } = useAuth();
  const router = useRouter();
  return useCallback(
    (purpose?: 'own') => {
      if (!profile) router.push('/login');
      else if (suspension && purpose !== 'own') {
        Alert.alert('You can’t post right now', suspensionText(suspension));
        return null;
      }
      return profile;
    },
    [profile, suspension, router],
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [suspension, setSuspension] = useState<AuthCtx['suspension']>(null);

  const load = useCallback(async (s: Session | null) => {
    setMonitoringUser(s?.user.id ?? null);
    if (!s) {
      setProfile(null);
      setSuspension(null);
      return;
    }
    const [{ data, error }, mine] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      getMySuspension(supabase, s.user.id).catch(() => null),
    ]);
    setProfile(data);
    setSuspension(mine);
    // A saved sign-in whose account no longer exists (deleted, or the database was reset):
    // drop it on this device so the app opens signed out instead of hanging.
    if (!data && !error) await signOut({ scope: 'local' });
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
  return <Ctx.Provider value={{ ready, session, profile, suspension, refreshProfile }}>{children}</Ctx.Provider>;
}
