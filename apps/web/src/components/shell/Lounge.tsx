'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { boardPicker, chatTime, deleteLoungeMessage, editLoungeMessage, getLoungeMessage, getLoungeMessages, promoteLoungeMessage, sendLoungeMessage, titleFromMessage, type LoungeMessage } from '@dtour/shared';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { Seal } from '../ui';
import { OnlineCount, useShell } from './Shell';
import { Dialog, ReportDialog, linkBtn } from '../Manage';
import { MentionText } from '../Markdown';

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
  const { me, requireMe, toast, loungeRoom } = useShell();
  const [room, setRoom] = useState(loungeRoom ?? rooms[0]?.slug ?? 'global');
  const [msgs, setMsgs] = useState<LoungeMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<LoungeMessage | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const keepScroll = useRef<number | null>(null);  // set while prepending older messages
  const list = useRef<HTMLDivElement>(null);
  const current = rooms.find((r) => r.slug === room);

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    getLoungeMessages(sb, room).then((m) => { if (alive) { setMsgs(m); setHasOlder(m.length >= 60); } });
    const ch = sb.channel(`lounge:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lounge_messages', filter: `room_slug=eq.${room}` }, async (payload) => {
        const id = (payload.new as { id: number }).id;
        const full = await getLoungeMessage(sb, id);
        setMsgs((cur) => cur.some((m) => m.id === id) ? cur : [...cur.filter((m) => !(m.pending && m.body === full.body && m.author.id === full.author.id)), full]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lounge_messages', filter: `room_slug=eq.${room}` }, async (payload) => {
        const full = await getLoungeMessage(sb, (payload.new as { id: number }).id);  // also picks up "Became a thread"
        setMsgs((cur) => cur.map((m) => m.id === full.id ? full : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lounge_messages', filter: `room_slug=eq.${room}` }, (payload) => {
        const id = (payload.old as { id?: number }).id;
        setMsgs((cur) => cur.filter((m) => m.id !== id));
      })
      .subscribe();
    return () => { alive = false; sb.removeChannel(ch); };
  }, [room]);

  useEffect(() => {
    const el = list.current; if (!el) return;
    if (keepScroll.current != null) { el.scrollTop = el.scrollHeight - keepScroll.current; keepScroll.current = null; return; }
    el.scrollTo({ top: el.scrollHeight });
  }, [msgs.length, room]);

  const loadOlder = async () => {
    const first = msgs.find((m) => m.id > 0); if (!first) return;
    const older = await getLoungeMessages(supabaseBrowser(), room, 60, first.created_at);
    keepScroll.current = list.current ? list.current.scrollHeight - list.current.scrollTop : null;
    setMsgs((cur) => [...older.filter((o) => !cur.some((c) => c.id === o.id)), ...cur]);
    setHasOlder(older.length >= 60);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    const me = requireMe(); if (!me) return;
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

  const saveEdit = async () => {
    if (!editing?.body.trim()) return;
    const { id, body } = editing;
    setEditing(null);
    setMsgs((cur) => cur.map((m) => m.id === id ? { ...m, body: body.trim(), edited_at: new Date().toISOString() } : m));
    try { await editLoungeMessage(supabaseBrowser(), id, body); } catch (e) { toast((e as Error).message); }
  };
  const remove = async (id: number) => {
    if (!confirm('Delete this message?')) return;
    const before = msgs;
    setMsgs((cur) => cur.filter((m) => m.id !== id));
    try { await deleteLoungeMessage(supabaseBrowser(), id); } catch (e) { setMsgs(before); toast((e as Error).message); }
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
        {hasOlder && <button className="btn btn-ghost" onClick={loadOlder} style={{ alignSelf: 'center' }}>Load earlier messages</button>}
        {msgs.map((m) => (
          <div key={m.id} className="lounge-msg" style={{ opacity: m.pending ? 0.6 : 1 }}>
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span>
              {m.society
                ? <><b>{m.society.name}</b> {m.society.verified && <Seal size={14} />}</>
                : <Link href={`/u/${m.author.handle}`} className="title-link"><b>{m.author.handle}</b></Link>}{' '}
              <span style={{ color: 'var(--color-neutral-700)' }}>{chatTime(m.created_at)}{m.edited_at && ' · edited'}</span>
              </span>
              {!m.pending && m.id > 0 && (
                <span className="lounge-msg-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 10, color: 'var(--color-neutral-700)' }}>
                  {me?.id === m.author.id
                    ? <>
                      <button style={linkBtn} onClick={() => setEditing({ id: m.id, body: m.body })}>Edit</button>
                      {!m.promoted_thread_id && <button style={linkBtn} onClick={() => setPromoting(m)}>Make thread</button>}
                      <button style={linkBtn} onClick={() => remove(m.id)}>Delete</button>
                    </>
                    : <button style={linkBtn} aria-label="Report message" onClick={() => requireMe() && setReporting(m.id)}><Icon name="flag" size={14} /></button>}
                </span>
              )}
            </div>
            {editing?.id === m.id ? (
              <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input autoFocus className="input" value={editing.body} maxLength={1000} aria-label="Edit message"
                  onChange={(e) => setEditing({ id: m.id, body: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
                  style={{ flex: 1, height: 36 }} />
                <button type="submit" className="btn btn-primary" style={{ height: 36 }}>Save</button>
              </form>
            ) : <MentionText text={m.body} />}
            {m.promoted && (
              <Link href={`/t/${m.promoted.id}`} style={{ marginTop: 8, padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 2, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                <Icon name="arrow-bend-down-right" size={18} color="var(--color-accent)" />
                Became a thread in {m.promoted.board?.name} · {m.promoted.reply_count} replies
              </Link>
            )}
          </div>
        ))}
        {promoting && <PromoteDialog message={promoting} onClose={() => setPromoting(null)} />}
        {reporting && <ReportDialog target={{ loungeMessageId: reporting }} onClose={() => setReporting(null)} />}
        {!msgs.length && <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>Quiet in here. Say hi.</div>}
      </div>
      <div style={{ padding: '14px 18px 20px' }}>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', alignItems: 'center', minHeight: 46, padding: '0 6px 0 14px', background: 'var(--color-surface)', borderRadius: 2 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={me ? `Message ${current?.short_label ?? current?.label ?? '#global'}` : 'Sign in to join the conversation'} onFocus={() => { if (!me) requireMe(); }} maxLength={1000}
            aria-label="Message" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', font: '400 15px var(--font-body)', color: 'var(--color-text)' }} />
          <button type="submit" aria-label="Send" style={{ width: 36, height: 36, borderRadius: 2, background: 'var(--color-accent)', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, cursor: 'pointer' }}>
            <Icon name="paper-plane-tilt" size={18} />
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Turn your own Lounge message into a thread: pick a board and a title. */
function PromoteDialog({ message, onClose }: { message: LoungeMessage; onClose: () => void }) {
  const { toast, setLoungeOpen } = useShell();
  const router = useRouter();
  const [boards, setBoards] = useState<Awaited<ReturnType<typeof boardPicker>> | null>(null);
  const [board, setBoard] = useState('');
  const [title, setTitle] = useState(titleFromMessage(message.body));
  const [busy, setBusy] = useState(false);
  useEffect(() => { boardPicker(supabaseBrowser()).then((b) => setBoards(b.filter((x) => !x.verified_only).sort((x, y) => x.path.join('›').localeCompare(y.path.join('›'))))).catch(() => setBoards([])); }, []);
  const submit = async () => {
    setBusy(true);
    try {
      const id = await promoteLoungeMessage(supabaseBrowser(), message.id, board, title);
      toast('Your message is now a thread.');
      onClose(); setLoungeOpen(false);
      router.push(`/t/${id}`);
    } catch (e) { toast((e as Error).message); setBusy(false); }
  };
  return (
    <Dialog title="Turn into a thread" onClose={onClose}>
      <div className="dialog-body">Your message becomes the thread’s body, and the Lounge shows a link to it.</div>
      <input className="input" aria-label="Thread title" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <select className="input" aria-label="Board" value={board} onChange={(e) => setBoard(e.target.value)}>
        <option value="">{boards ? 'Pick a board…' : 'Loading boards…'}</option>
        {boards?.map((b) => <option key={b.id} value={b.id}>{b.path.join(' › ')}</option>)}
      </select>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !board || title.trim().length < 3} onClick={submit}>Post thread</button>
      </div>
    </Dialog>
  );
}
