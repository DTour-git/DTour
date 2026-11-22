import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

/** One student online, without saying who: just the board they're reading, for per-board counts. */
interface OnlineEntry {
  board: string | null;
}
const Ctx = createContext<{ online: OnlineEntry[]; setBoard: (s: string | null) => void }>({ online: [], setBoard: () => {} });
export const usePresence = () => useContext(Ctx);

/**
 * Same channels as the website (#41). Signed-in students announce who they are
 * on the private presence:dtour channel (so they show by name on the website)
 * and leave an anonymous entry on the public presence:dtour:count channel. The
 * app only ever shows counts, so it reads the anonymous one, for visitors too.
 */
export function PresenceProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { profile } = useAuth();
  const [online, setOnline] = useState<OnlineEntry[]>([]);
  const count = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const named = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const board = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const c = supabase.channel('presence:dtour:count', { config: { presence: { key: `anon-${Math.random().toString(36).slice(2)}` } } });
    count.current = c;
    c.on('presence', { event: 'sync' }, () => {
      setOnline(
        Object.values(c.presenceState<OnlineEntry>())
          .map((l) => l[0])
          .filter(Boolean),
      );
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && profile) await c.track({ board: board.current });
    });

    let n: ReturnType<typeof supabase.channel> | null = null;
    if (profile) {
      (async () => {
        await supabase.realtime.setAuth(); // the private channel checks the student's JWT
        if (cancelled) return;
        n = supabase.channel('presence:dtour', { config: { private: true, presence: { key: profile.id } } });
        named.current = n;
        n.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await n?.track({ id: profile.id, handle: profile.handle, board: board.current, society: null });
        });
      })();
    }
    return () => {
      cancelled = true;
      supabase.removeChannel(c);
      if (n) supabase.removeChannel(n);
      count.current = null;
      named.current = null;
    };
  }, [enabled, profile?.id, profile?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBoard = (s: string | null) => {
    board.current = s;
    if (!profile) return;
    count.current?.track({ board: s });
    named.current?.track({ id: profile.id, handle: profile.handle, board: s, society: null });
  };
  return <Ctx.Provider value={{ online, setBoard }}>{children}</Ctx.Provider>;
}
