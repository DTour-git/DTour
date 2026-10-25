'use client';

// Managing posts after they're up: edit/delete your own, report someone
// else's, and (for team owners) answer join requests.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  REPORT_REASONS, ago, deleteThread, editThread, flair, reportContent, reviewTeamRequest,
  type ReportReason, type ReportTarget, type TeamRequest,
} from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from './Icon';
import { Avatar } from './ui';
import { useShell } from './shell/Shell';

export const linkBtn: React.CSSProperties = { background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 };

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg)', width: 'min(560px, 100%)' }}>
        <div className="dialog-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { requireMe, toast } = useShell();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const me = requireMe(); if (!me || !reason) return;
    setBusy(true);
    try {
      const fresh = await reportContent(supabaseBrowser(), { userId: me.id, target, reason, details });
      toast(fresh ? 'Thanks. A moderator will take a look.' : 'You already reported this.');
      onClose();
    } catch (e) { toast((e as Error).message); setBusy(false); }
  };
  return (
    <Dialog title="Report this post" onClose={onClose}>
      <div className="dialog-body">Moderators see reports in the moderation queue. The author isn&apos;t told who reported them.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REPORT_REASONS.map(([k, label]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, cursor: 'pointer' }}>
            <input type="radio" name="report-reason" checked={reason === k} onChange={() => setReason(k)} />{label}
          </label>
        ))}
      </div>
      <textarea className="input" placeholder="Anything moderators should know (optional)" value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} style={{ minHeight: 70 }} />
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!reason || busy} onClick={submit}><Icon name="flag" size={17} />Report</button>
      </div>
    </Dialog>
  );
}

/** Edit · Delete for the author, Report for everyone else. */
export function ThreadManage({ thread, boardSlug }: { thread: { id: number; title: string; body: string; authorId: string }; boardSlug: string }) {
  const { me, requireMe, toast } = useShell();
  const router = useRouter();
  const [open, setOpen] = useState<'edit' | 'report' | null>(null);
  const [f, setF] = useState({ title: thread.title, body: thread.body });
  const [pending, start] = useTransition();
  const mine = me?.id === thread.authorId;

  const save = async () => {
    if (f.title.trim().length < 3) { toast('The title needs at least 3 characters.'); return; }
    try { await editThread(supabaseBrowser(), thread.id, f); setOpen(null); start(() => router.refresh()); toast('Saved.'); }
    catch (e) { toast((e as Error).message); }
  };
  const remove = async () => {
    if (!confirm('Delete this thread and all its replies? This can’t be undone.')) return;
    try { await deleteThread(supabaseBrowser(), thread.id); toast('Thread deleted.'); router.push(`/b/${boardSlug}`); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 16, fontSize: 13.5, color: 'var(--color-neutral-700)' }}>
      {mine ? <>
        <button style={linkBtn} onClick={() => setOpen('edit')}><Icon name="pencil-simple-line" size={16} />Edit</button>
        <button style={linkBtn} onClick={remove}><Icon name="trash" size={16} />Delete</button>
      </> : <button style={linkBtn} onClick={() => requireMe() && setOpen('report')}><Icon name="flag" size={16} />Report</button>}
      {open === 'report' && <ReportDialog target={{ threadId: thread.id }} onClose={() => setOpen(null)} />}
      {open === 'edit' && (
        <Dialog title="Edit thread" onClose={() => setOpen(null)}>
          <input className="input" value={f.title} maxLength={140} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Title" />
          <textarea className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-label="Body" style={{ minHeight: 220, font: '400 15px/1.55 var(--font-body)' }} />
          <div className="dialog-body">Markdown + LaTeX supported. Edited posts show “edited”.</div>
          <div className="dialog-actions">
            <button className="btn btn-ghost" onClick={() => setOpen(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={pending} onClick={save}>Save</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** Pending join requests on a team you own, with accept (and fill a role) or decline. */
export function TeamRequests({ teamId, requests, openRoles }: { teamId: number; requests: TeamRequest[]; openRoles: { id: number; name: string }[] }) {
  const { toast } = useShell();
  const router = useRouter();
  const [list, setList] = useState(requests);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  if (!list.length) return null;

  const answer = async (userId: string, accept: boolean) => {
    const roleId = roles[userId] ? Number(roles[userId]) : null;
    try {
      await reviewTeamRequest(supabaseBrowser(), { teamId, userId, accept, roleId });
      setList((l) => l.filter((r) => r.user.id !== userId));
      toast(accept ? 'Added to your team.' : 'Request declined.');
      start(() => router.refresh());
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="label-caps" style={{ color: 'var(--color-accent-700)' }}>{list.length} {list.length === 1 ? 'request' : 'requests'} to join</div>
      {list.map((r) => (
        <div key={r.user.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Avatar person={r.user} size={30} />
          <div style={{ lineHeight: 1.3, minWidth: 0, flex: '1 1 140px' }}>
            <Link href={`/u/${r.user.handle}`} style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--color-text)' }}>@{r.user.handle}</Link>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{flair(r.user.branch_code, r.user.grad_year) ? ` · ${flair(r.user.branch_code, r.user.grad_year)}` : ''} · {ago(r.created_at)}</span>
            {r.user.skills.length > 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{r.user.skills.join(', ')}</div>}
          </div>
          {openRoles.length > 0 && (
            <select className="input" aria-label="Role" value={roles[r.user.id] ?? ''} onChange={(e) => setRoles({ ...roles, [r.user.id]: e.target.value })} style={{ height: 34, width: 'auto', fontSize: 13.5, padding: '0 8px' }}>
              <option value="">No role yet</option>
              {openRoles.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button className="btn btn-ghost" style={{ height: 34 }} onClick={() => answer(r.user.id, false)}>Decline</button>
          <button className="btn btn-primary" style={{ height: 34 }} onClick={() => answer(r.user.id, true)}>Accept</button>
        </div>
      ))}
    </div>
  );
}
