'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  acceptReply, ago, deleteReply, editReply, postReply, setBoardJoined, setSaved, voteReply, voteThread, votePoll, n,
  type ReplyNode,
} from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { Avatar, FlairTag, Seal, Tag } from '../ui';
import { useShell } from '../shell/Shell';
import { ReportDialog, linkBtn } from '../Manage';
import { MentionText } from '../Markdown';

/** Vertical rail: upvote · score · downvote · save · share (optimistic). */
export function VoteRail({ threadId, score, myVote, saved }: { threadId: number; score: number; myVote: number; saved: boolean }) {
  const { requireMe, toast } = useShell();
  const [v, setV] = useState(myVote);
  const [s, setS] = useState(score);
  const [isSaved, setIsSaved] = useState(saved);

  const vote = async (dir: 1 | -1) => {
    if (!requireMe()) return;
    const next = v === dir ? 0 : dir;
    setS(s + (next - v)); setV(next);
    try { setS(await voteThread(supabaseBrowser(), threadId, next as -1 | 0 | 1)); }
    catch { setS(s); setV(v); toast('Vote failed.'); }
  };
  const save = async () => {
    const me = requireMe(); if (!me) return;
    setIsSaved(!isSaved);
    try { await setSaved(supabaseBrowser(), threadId, me.id, !isSaved); toast(!isSaved ? 'Saved to your profile.' : 'Removed from saved.'); }
    catch { setIsSaved(isSaved); }
  };
  const share = async () => {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-neutral-700)' }}>
      <button className="vote-btn" onClick={() => vote(1)} aria-label="Upvote" aria-pressed={v === 1}>
        <Icon name="arrow-fat-up" size={26} color="var(--color-accent)" weight={v === 1 ? 'fill' : 'duotone'} />
      </button>
      <span style={{ font: '600 18px var(--font-heading)', color: 'var(--color-text)' }}>{n(s)}</span>
      <button className="vote-btn" onClick={() => vote(-1)} aria-label="Downvote" aria-pressed={v === -1}>
        <Icon name="arrow-fat-down" size={26} weight={v === -1 ? 'fill' : 'duotone'} color={v === -1 ? 'var(--color-accent-2)' : undefined} />
      </button>
      <button className="vote-btn" onClick={save} aria-label={isSaved ? 'Unsave' : 'Save'} style={{ marginTop: 16 }}>
        <Icon name="bookmark-simple" size={22} weight={isSaved ? 'fill' : 'duotone'} color={isSaved ? 'var(--color-accent)' : undefined} />
      </button>
      <button className="vote-btn" onClick={share} aria-label="Share" style={{ marginTop: 12 }}><Icon name="share-network" size={22} /></button>
    </div>
  );
}

export function ReplyComposer({ threadId, parentId, onDone, autoFocus, placeholder = 'Add a reply…' }: {
  threadId: number; parentId?: number; onDone?: () => void; autoFocus?: boolean; placeholder?: string;
}) {
  const { me, requireMe, toast } = useShell();
  const router = useRouter();
  const [open, setOpen] = useState(!!autoFocus);
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();

  const submit = async () => {
    const me = requireMe(); if (!me || !body.trim()) return;
    try {
      await postReply(supabaseBrowser(), { threadId, userId: me.id, body, parentId });
      setBody(''); setOpen(false); onDone?.();
      start(() => router.refresh());
    } catch (e) { toast((e as Error).message); }
  };

  if (!open) {
    return (
      <button onClick={() => requireMe() && setOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 2, color: 'var(--color-neutral-700)', fontSize: 15, border: 0, cursor: 'text', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
        {me ? <Avatar person={me} size={30} /> : <Avatar person={{ handle: '?', tint: 'neutral' }} size={30} label="?" />}<span style={{ paddingTop: 4 }}>{me ? placeholder : 'Sign in with your DTU account to reply'}</span>
      </button>
    );
  }
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '12px 14px' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {me && <Avatar person={me} size={30} />}
        <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} rows={4}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }}
          style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', resize: 'vertical', font: '400 16px/1.6 var(--font-body)', color: 'var(--color-text)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>Markdown + LaTeX supported · ⌘↵ to post</span>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => { setOpen(false); onDone?.(); }}>Cancel</button>
        <button className="btn btn-primary" disabled={pending || !body.trim()} onClick={submit}><Icon name="paper-plane-tilt" size={17} />Reply</button>
      </div>
    </div>
  );
}

export function ReplyItem({ r, threadId, opId, acceptedId, isOp, depth = 0 }: {
  r: ReplyNode; threadId: number; opId: string; acceptedId: number | null; isOp: boolean; depth?: number;
}) {
  const { me, toast, requireMe } = useShell();
  const router = useRouter();
  const [v, setV] = useState(r.myVote);
  const [s, setS] = useState(r.score);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [, start] = useTransition();
  const mine = me?.id === r.author.id;
  const deleted = !!r.deleted_at;
  const nested = depth > 0;
  const accepted = r.id === acceptedId;

  const vote = async () => {
    if (!requireMe()) return;
    const next = v === 1 ? 0 : 1;
    setS(s + (next - v)); setV(next);
    try { setS(await voteReply(supabaseBrowser(), r.id, next as 0 | 1)); } catch { setS(s); setV(v); }
  };
  const accept = async () => {
    try { await acceptReply(supabaseBrowser(), threadId, accepted ? null : r.id); router.refresh(); }
    catch (e) { toast((e as Error).message); }
  };

  const saveEdit = async () => {
    if (!editing?.trim()) return;
    try { await editReply(supabaseBrowser(), r.id, editing); setEditing(null); start(() => router.refresh()); }
    catch (e) { toast((e as Error).message); }
  };
  const remove = async () => {
    if (!confirm('Delete this reply? This can’t be undone.')) return;
    try { await deleteReply(supabaseBrowser(), r.id); toast('Reply deleted.'); start(() => router.refresh()); }
    catch (e) { toast((e as Error).message); }
  };

  const size = nested ? 30 : 36;
  return (
    <div id={`reply-${r.id}`} style={nested
      ? { display: 'grid', gridTemplateColumns: `${size}px minmax(0,1fr)`, gap: 12, marginTop: 20, paddingLeft: 16, borderLeft: '2px solid var(--color-neutral-300)' }
      : { display: 'grid', gridTemplateColumns: `${size}px minmax(0,1fr)`, gap: 14 }}>
      <Avatar person={r.author} society={r.society} size={size} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: nested ? 13 : 13.5, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
          {r.society ? <><b style={{ color: 'var(--color-text)' }}>{r.society.name}</b>{r.society.verified && <Seal size={16} />}<span>Society</span></>
            : <><Link href={`/u/${r.author.handle}`} style={{ color: 'var(--color-text)', fontWeight: 600 }}>@{r.author.handle}</Link>{r.author.id === opId ? <Tag tone="accent2">OP</Tag> : <FlairTag person={r.author} />}</>}
          <span>· {ago(r.created_at)}{r.edited_at && !deleted && ' · edited'}</span>
          {accepted && <Tag tone="accent" style={{ marginLeft: 6 }}><Icon name="check" size={13} style={{ marginRight: 4 }} />Accepted</Tag>}
        </div>
        {editing !== null ? (
          <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '10px 12px', marginTop: 6, maxWidth: 640 }}>
            <textarea autoFocus value={editing} onChange={(e) => setEditing(e.target.value)} rows={4} aria-label="Edit reply"
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
              style={{ width: '100%', border: 0, background: 'transparent', outline: 'none', resize: 'vertical', font: '400 16px/1.6 var(--font-body)', color: 'var(--color-text)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!editing.trim()} onClick={saveEdit}>Save</button>
            </div>
          </div>
        ) : deleted
          ? <div style={{ fontSize: nested ? 15.5 : 16, marginTop: nested ? 4 : 6, fontStyle: 'italic', color: 'var(--color-neutral-700)' }}>{r.body}</div>
          : <div style={{ fontSize: nested ? 15.5 : 16, lineHeight: nested ? 1.55 : 1.6, marginTop: nested ? 4 : 6, maxWidth: 640, whiteSpace: 'pre-wrap' }}><MentionText text={r.body} /></div>}
        {!deleted && <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 13.5, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
          <button onClick={vote} className="vote-btn" style={{ alignItems: 'center', gap: 4, fontSize: 13.5, fontFamily: 'var(--font-body)' }} aria-label="Upvote reply" aria-pressed={v === 1}>
            <Icon name="arrow-fat-up" size={17} color={v === 1 || s > 0 ? 'var(--color-accent)' : undefined} weight={v === 1 ? 'fill' : 'duotone'} />{s}
          </button>
          <button className="vote-btn" onClick={() => requireMe() && setReplying(true)} style={{ fontSize: 13.5, fontFamily: 'var(--font-body)' }}>Reply</button>
          {isOp && !nested && <button className="vote-btn" onClick={accept} style={{ fontSize: 13.5, fontFamily: 'var(--font-body)' }}>{accepted ? 'Unaccept' : 'Accept answer'}</button>}
          {mine
            ? <>
              <button style={linkBtn} onClick={() => setEditing(r.body)}>Edit</button>
              <button style={linkBtn} onClick={remove}>Delete</button>
            </>
            : <button style={linkBtn} onClick={() => requireMe() && setReporting(true)}>Report</button>}
        </div>}
        {reporting && <ReportDialog target={{ replyId: r.id }} onClose={() => setReporting(false)} />}
        {replying && <div style={{ marginTop: 12 }}><ReplyComposer threadId={threadId} parentId={nested ? (r.parent_id ?? r.id) : r.id} autoFocus onDone={() => setReplying(false)} placeholder={`Reply to @${r.author.handle}…`} /></div>}
        {r.children.map((c) => <ReplyItem key={c.id} r={c} threadId={threadId} opId={opId} acceptedId={acceptedId} isOp={isOp} depth={depth + 1} />)}
      </div>
    </div>
  );
}

export function JoinBoard({ boardId, joined }: { boardId: string; joined: boolean }) {
  const { requireMe } = useShell();
  const [j, setJ] = useState(joined);
  const toggle = async () => {
    const me = requireMe(); if (!me) return;
    setJ(!j);
    try { await setBoardJoined(supabaseBrowser(), boardId, me.id, !j); } catch { setJ(j); }
  };
  return <button className={`btn ${j ? 'btn-secondary' : 'btn-primary'}`} style={{ marginTop: 12 }} onClick={toggle}>{j ? 'Joined' : 'Join'}</button>;
}

export function PollBox({ threadId, options, mine }: { threadId: number; options: { id: number; label: string; votes: number }[]; mine: number | null }) {
  const { requireMe, toast } = useShell();
  const [opts, setOpts] = useState(options);
  const [sel, setSel] = useState(mine);
  const total = opts.reduce((s, o) => s + o.votes, 0);
  const pick = async (id: number) => {
    const me = requireMe(); if (!me || id === sel) return;
    const prev = { opts, sel };
    setOpts(opts.map((o) => ({ ...o, votes: o.votes + (o.id === id ? 1 : 0) - (o.id === sel ? 1 : 0) })));
    setSel(id);
    try { await votePoll(supabaseBrowser(), threadId, id, me.id); } catch { setOpts(prev.opts); setSel(prev.sel); toast('Vote failed.'); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520, marginTop: 18 }}>
      {opts.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <button key={o.id} onClick={() => pick(o.id)} style={{ position: 'relative', textAlign: 'left', padding: '10px 14px', border: 0, borderRadius: 2, cursor: 'pointer', background: 'var(--color-surface)', boxShadow: sel === o.id ? 'inset 0 0 0 2px var(--color-accent)' : 'none', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
            {sel != null && <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--color-accent-100)' }} />}
            <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--color-text)' }}>
              <span style={{ fontWeight: sel === o.id ? 600 : 400 }}>{o.label}</span>{sel != null && <b>{pct}%</b>}
            </span>
          </button>
        );
      })}
      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{n(total)} votes</div>
    </div>
  );
}

export function DownloadLink({ itemId, children, style }: { itemId: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const { toast, requireMe } = useShell();
  const go = async () => {
    if (!requireMe()) return;
    try {
      const { downloadItem } = await import('@dtour/shared');
      const url = await downloadItem(supabaseBrowser(), itemId);
      if (url) window.open(url, '_blank');
      else toast('This is a demo file — real uploads download here.');
    } catch (e) { toast((e as Error).message); }
  };
  return <button onClick={go} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', ...style }}>{children}</button>;
}
