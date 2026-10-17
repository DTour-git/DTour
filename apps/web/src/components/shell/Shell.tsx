'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ProfileRow } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';

export interface OnlineUser { id: string; handle: string; board: string | null; society: string | null }

interface ShellCtx {
  /** Signed-in profile, or null for a visitor reading without an account. */
  me: ProfileRow | null;
  /** Returns the profile, or sends a visitor to sign in and returns null. Call at the start of any write. */
  requireMe: () => ProfileRow | null;
  online: OnlineUser[];
  setPresenceBoard: (slug: string | null) => void;
  searchOpen: boolean;
  openSearch: (q?: string) => void;
  closeSearch: () => void;
  initialQuery: string;
  loungeOpen: boolean;
  setLoungeOpen: (v: boolean) => void;
  loungeRoom: string | null;
  openLounge: (room: string) => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<ShellCtx | null>(null);
export const useShell = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useShell outside <Shell>');
  return c;
};

export function Shell({ me, children }: { me: ProfileRow | null; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [loungeOpen, setLoungeOpen] = useState(false);
  const [loungeRoom, setLoungeRoom] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>['channel']> | null>(null);
  const boardRef = useRef<string | null>(null);

  // Realtime presence: who's on DTour right now, and which board they're reading.
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel('presence:dtour', { config: { presence: { key: me?.id ?? `visitor-${Math.random().toString(36).slice(2)}` } } });
    channelRef.current = ch;
    const sync = () => {
      const state = ch.presenceState<OnlineUser>();
      const users = Object.values(state).map((list) => list[0]).filter(Boolean);
      setOnline(users);
    };
    ch.on('presence', { event: 'sync' }, sync)
      .subscribe(async (status) => {
        // Visitors watch the count; only members are counted.
        if (status === 'SUBSCRIBED' && me) await ch.track({ id: me.id, handle: me.handle, board: boardRef.current, society: null });
      });
    return () => { sb.removeChannel(ch); };
  }, [me?.id, me?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPresenceBoard = useCallback((slug: string | null) => {
    boardRef.current = slug;
    if (me) channelRef.current?.track({ id: me.id, handle: me.handle, board: slug, society: null });
  }, [me]);

  // `/` (when not typing) or ⌘K / Ctrl+K opens the search palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setInitialQuery('');
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const requireMe = useCallback(() => {
    if (!me) router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return me;
  }, [me, router, pathname]);

  const value = useMemo<ShellCtx>(() => ({
    me, requireMe, online, setPresenceBoard, searchOpen,
    openSearch: (q = '') => { setInitialQuery(q); setSearchOpen(true); },
    closeSearch: () => setSearchOpen(false),
    initialQuery, loungeOpen, setLoungeOpen, loungeRoom, openLounge: (room: string) => { setLoungeRoom(room); setLoungeOpen(true); }, toast,
  }), [me, requireMe, online, setPresenceBoard, searchOpen, initialQuery, loungeOpen, loungeRoom, toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

/** Sets the presence "board" for the current page (thread/board pages). */
export function PresenceBoard({ slug }: { slug: string }) {
  const { setPresenceBoard } = useShell();
  useEffect(() => {
    setPresenceBoard(slug);
    return () => setPresenceBoard(null);
  }, [slug, setPresenceBoard]);
  return null;
}

export function OnlineCount({ board, suffix = '' }: { board?: string; suffix?: string }) {
  const { online } = useShell();
  const n = board ? online.filter((u) => u.board === board).length : online.length;
  return <>{n.toLocaleString('en-US')}{suffix}</>;
}
