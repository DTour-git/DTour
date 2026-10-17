'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ago, getNotifications, markNotificationsRead, NOTIFICATION_ICON, unreadNotificationCount, type NotificationRow } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { Avatar } from '../ui';
import { useShell } from './Shell';

/** Bell with a live unread count: mentions, replies, comments, upvotes, accepted answers, team requests, wiki reviews. */
export function NotificationBell() {
  const { me } = useShell();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) return;
    const sb = supabaseBrowser();
    let ch: ReturnType<typeof sb.channel> | null = null;
    let alive = true;
    unreadNotificationCount(sb).then(setUnread);
    // Realtime must carry the user's JWT, or RLS hides their own notification rows.
    sb.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      await sb.realtime.setAuth(data.session?.access_token ?? null);
      ch = sb.channel(`notifications:${me.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, () => {
          unreadNotificationCount(sb).then(setUnread);
          setItems(null);
        }).subscribe();
    });
    return () => { alive = false; if (ch) sb.removeChannel(ch); };
  }, [me]);

  useEffect(() => {
    if (!open) return;
    const sb = supabaseBrowser();
    getNotifications(sb).then(setItems);
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, items === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) { await markNotificationsRead(supabaseBrowser()); setUnread(0); }
  };

  if (!me) return null;
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={open}
        style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 0, cursor: 'pointer', position: 'relative', color: 'var(--color-text)' }}>
        <Icon name="bell" size={24} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: 'var(--color-accent-2)', color: 'var(--color-bg)', font: '600 10.5px/17px var(--font-body)', textAlign: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" style={{ position: 'absolute', right: 0, top: 48, width: 'min(380px, calc(100vw - 32px))', maxHeight: 480, overflow: 'auto', background: 'var(--color-bg)', boxShadow: 'var(--shadow-lg)', borderRadius: 4, zIndex: 25 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px 10px', borderBottom: '1px solid var(--color-divider)' }}>
            <h4 style={{ margin: 0 }}>Notifications</h4>
          </div>
          {items === null && <div style={{ padding: 18, fontSize: 14, color: 'var(--color-neutral-700)' }}>Loading…</div>}
          {items?.length === 0 && <div style={{ padding: 18, fontSize: 14.5, color: 'var(--color-neutral-700)', lineHeight: 1.5 }}>Nothing yet. Replies, mentions in the Lounge, upvotes and accepted answers show up here.</div>}
          {items?.map((n) => (
            <Link key={n.id} href={n.route} onClick={() => setOpen(false)} className="hover-row row-rule"
              style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 12, padding: '12px 18px', color: 'var(--color-text)', background: n.read_at ? undefined : 'var(--color-accent-100)' }}>
              <span style={{ position: 'relative' }}>
                {n.actor ? <Avatar person={n.actor} size={32} /> : <Avatar person={{ handle: '?', tint: 'neutral' }} size={32} />}
                <span style={{ position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={NOTIFICATION_ICON[n.kind] ?? 'bell'} size={13} color={n.kind === 'upvote' || n.kind === 'accepted' ? 'var(--color-accent)' : 'var(--color-accent-2)'} />
                </span>
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, lineHeight: 1.4 }}><b>@{n.actor?.handle ?? 'someone'}</b> {n.text}</span>
                {n.snippet && <span className="ellipsis" style={{ display: 'block', fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>{n.snippet}</span>}
                <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2 }}>{ago(n.created_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
