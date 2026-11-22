'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ProfileRow } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';

export interface OnlineUser {
  id: string;
  handle: string;
  board: string | null;
  society: string | null;
}

interface ShellCtx {
  /** Signed-in profile, or null for a visitor reading without an account. */
  me: ProfileRow | null;
  /** Returns the profile, or sends a visitor to sign in and returns null. Call at the start of any write. */
  requireMe: () => ProfileRow | null;
  /** Signed-in students online, with names and boards. Empty for visitors (#41). */
  online: OnlineUser[];
  /** How many students are online, for everyone, visitors included. */
  onlineCount: number;
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
  const [onlineCount, setOnlineCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [loungeOpen, setLoungeOpen] = useState(false);
  const [loungeRoom, setLoungeRoom] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>['channel']> | null>(null);
  const countRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>['channel']> | null>(null);
  const boardRef = useRef<string | null>(null);

  // Realtime presence (#41). Who's online and which board they're reading is on
  // a private channel only signed-in students can join (RLS on realtime.messages).
  // Each student also leaves an anonymous entry (no id, no handle) on a public
  // channel, so visitors still see how many people are here.
  useEffect(() => {
    const sb = supabaseBrowser();
    let cancelled = false;
    const count = sb.channel('presence:dtour:count', { config: { presence: { key: `anon-${Math.random().toString(36).slice(2)}` } } });
    countRef.current = count;
    count
      .on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(count.presenceState()).length))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && me) await count.track({ board: boardRef.current });
      });

    let named: ReturnType<typeof sb.channel> | null = null;
    if (me) {
      (async () => {
        await sb.realtime.setAuth(); // the private channel checks the student's JWT
        if (cancelled) return;
        const ch = sb.channel('presence:dtour', { config: { private: true, presence: { key: me.id } } });
        named = ch;
        channelRef.current = ch;
        ch.on('presence', { event: 'sync' }, () => {
          setOnline(
            Object.values(ch.presenceState<OnlineUser>())
              .map((list) => list[0])
              .filter(Boolean),
          );
        }).subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await ch.track({ id: me.id, handle: me.handle, board: boardRef.current, society: null });
        });
      })();
    }
    return () => {
      cancelled = true;
      sb.removeChannel(count);
      if (named) sb.removeChannel(named);
      channelRef.current = null;
    };
  }, [me?.id, me?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPresenceBoard = useCallback(
    (slug: string | null) => {
      boardRef.current = slug;
      if (!me) return;
      countRef.current?.track({ board: slug });
      channelRef.current?.track({ id: me.id, handle: me.handle, board: slug, society: null });
    },
    [me],
  );

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

  const value = useMemo<ShellCtx>(
    () => ({
      me,
      requireMe,
      online: me ? online : [],
      onlineCount,
      setPresenceBoard,
      searchOpen,
      openSearch: (q = '') => {
        setInitialQuery(q);
        setSearchOpen(true);
      },
      closeSearch: () => setSearchOpen(false),
      initialQuery,
      loungeOpen,
      setLoungeOpen,
      loungeRoom,
      openLounge: (room: string) => {
        setLoungeRoom(room);
        setLoungeOpen(true);
      },
      toast,
    }),
    [me, requireMe, online, onlineCount, setPresenceBoard, searchOpen, initialQuery, loungeOpen, loungeRoom, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
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
  return (
    <>
      {n.toLocaleString('en-US')}
      {suffix}
    </>
  );
}
