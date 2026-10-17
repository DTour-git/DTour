'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { chatTime, getLoungeMessage, getLoungeMessages, sendLoungeMessage, type LoungeMessage } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { Seal } from '../ui';
import { OnlineCount, useShell } from './Shell';

export interface Room { slug: string; label: string; short_label: string | null }

export function Lounge({ rooms }: { rooms: Room[] }) {
  const { loungeOpen, setLoungeOpen } = useShell();
  if (!loungeOpen) {
    return (
      <button className="btn btn-primary elev-md lounge-fab" onClick={() => setLoungeOpen(true)}>
        <Icon name="chats-circle" size={20} />Lounge · <OnlineCount /> online
      </button>
    );
  }
  return <Drawer rooms={rooms} onClose={() => setLoungeOpen(false)} />;
}

function Drawer({ rooms, onClose }: { rooms: Room[]; onClose: () => void }) {
  const { me, toast } = useShell();
  const [room, setRoom] = useState(rooms[0]?.slug ?? 'global');
  const [msgs, setMsgs] = useState<LoungeMessage[]>([]);
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const current = rooms.find((r) => r.slug === room);

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    getLoungeMessages(sb, room).then((m) => alive && setMsgs(m));
    const ch = sb.channel(`lounge:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lounge_messages', filter: `room_slug=eq.${room}` }, async (payload) => {
        const id = (payload.new as { id: number }).id;
        const full = await getLoungeMessage(sb, id);
        setMsgs((cur) => cur.some((m) => m.id === id) ? cur : [...cur.filter((m) => !(m.pending && m.body === full.body && m.author.id === full.author.id)), full]);
      })
      .subscribe();
    return () => { alive = false; sb.removeChannel(ch); };
  }, [room]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs.length, room]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const temp: LoungeMessage = {
      id: -Date.now(), room_slug: room, body, created_at: new Date().toISOString(), promoted_thread_id: null,
      author: { id: me.id, handle: me.handle, display_name: me.display_name, branch_code: me.branch_code, grad_year: me.grad_year, tint: me.tint as never, karma: me.karma },
      society: null, pending: true,
    };
    setMsgs((m) => [...m, temp]);
    try { await sendLoungeMessage(supabaseBrowser(), room, me.id, body); }
    catch { setMsgs((m) => m.filter((x) => x.id !== temp.id)); setDraft(body); toast('Message not sent — try again.'); }
  };

  return (
    <aside className="drawer" aria-label="Lounge">
      <div style={{ padding: '22px 22px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h4 style={{ margin: 0 }}>Lounge</h4>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-neutral-700)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-accent)' }} /><OnlineCount /> here
          </span>
          <button className="btn btn-icon" onClick={onClose} style={{ marginLeft: 'auto' }} aria-label="Close Lounge"><Icon name="x" size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, font: '600 14px var(--font-heading)' }} role="tablist">
          {rooms.map((r) => (
            <button key={r.slug} role="tab" aria-selected={r.slug === room} onClick={() => setRoom(r.slug)}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: r.slug === room ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>
              {r.short_label ?? r.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={list} style={{ flex: 1, overflow: 'auto', padding: '8px 22px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 15, lineHeight: 1.45 }}>
        {msgs.map((m) => (
          <div key={m.id} style={{ opacity: m.pending ? 0.6 : 1 }}>
            <div style={{ fontSize: 13 }}>
              {m.society
                ? <><b>{m.society.name}</b> {m.society.verified && <Seal size={14} />}</>
                : <Link href={`/u/${m.author.handle}`} className="title-link"><b>{m.author.handle}</b></Link>}{' '}
              <span style={{ color: 'var(--color-neutral-700)' }}>{chatTime(m.created_at)}</span>
            </div>
            {m.body}
            {m.promoted && (
              <Link href={`/t/${m.promoted.id}`} style={{ marginTop: 8, padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 2, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                <Icon name="arrow-bend-down-right" size={18} color="var(--color-accent)" />
                Became a thread in {m.promoted.board?.name} · {m.promoted.reply_count} replies
              </Link>
            )}
          </div>
        ))}
        {!msgs.length && <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>Quiet in here. Say hi.</div>}
      </div>
      <div style={{ padding: '14px 18px 20px' }}>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', alignItems: 'center', minHeight: 46, padding: '0 6px 0 14px', background: 'var(--color-surface)', borderRadius: 2 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${current?.short_label ?? current?.label ?? '#global'}`} maxLength={1000}
            aria-label="Message" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', font: '400 15px var(--font-body)', color: 'var(--color-text)' }} />
          <button type="submit" aria-label="Send" style={{ width: 36, height: 36, borderRadius: 2, background: 'var(--color-accent)', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, cursor: 'pointer' }}>
            <Icon name="paper-plane-tilt" size={18} />
          </button>
        </form>
      </div>
    </aside>
  );
}
