import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

interface OnlineUser { id: string; handle: string; board: string | null }
const Ctx = createContext<{ online: OnlineUser[]; setBoard: (s: string | null) => void }>({ online: [], setBoard: () => {} });
export const usePresence = () => useContext(Ctx);

/** Same realtime presence channel as the website, so counts match across web and app. */
export function PresenceProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { profile } = useAuth();
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const ch = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const board = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const c = supabase.channel('presence:dtour', { config: { presence: { key: profile?.id ?? `visitor-${Math.random().toString(36).slice(2)}` } } });
    ch.current = c;
    c.on('presence', { event: 'sync' }, () => {
      setOnline(Object.values(c.presenceState<OnlineUser>()).map((l) => l[0]).filter(Boolean));
    }).subscribe(async (status) => {
      // Visitors watch the count; only members are counted.
      if (status === 'SUBSCRIBED' && profile) await c.track({ id: profile.id, handle: profile.handle, board: board.current });
    });
    return () => { supabase.removeChannel(c); ch.current = null; };
  }, [enabled, profile?.id, profile?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBoard = (s: string | null) => {
    board.current = s;
    if (profile) ch.current?.track({ id: profile.id, handle: profile.handle, board: s });
  };
  return <Ctx.Provider value={{ online, setBoard }}>{children}</Ctx.Provider>;
}
