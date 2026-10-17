'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agoLong, reviewArticle, reviewRevision, type PendingArticle, type PendingRevision } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Markdown } from './Markdown';
import { Tag } from './ui';
import { useShell } from './shell/Shell';

export function ModQueue({ articles, revisions }: { articles: PendingArticle[]; revisions: PendingRevision[] }) {
  const router = useRouter();
  const { toast } = useShell();
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = async (key: string, fn: () => Promise<void>, msg: string) => {
    try { await fn(); toast(msg); router.refresh(); } catch (e) { toast((e as Error).message); }
    setOpen(null);
  };
  const Actions = ({ k, onApprove, onReject }: { k: string; onApprove: () => Promise<void>; onReject: () => Promise<void> }) => (
    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <input className="input" placeholder="Note to the author (optional)" value={notes[k] ?? ''} onChange={(e) => setNotes({ ...notes, [k]: e.target.value })} style={{ flex: 1, minWidth: 200, height: 38 }} />
      <button className="btn btn-secondary" onClick={() => act(k, onReject, 'Rejected — the author has been notified.')}>Reject</button>
      <button className="btn btn-primary" onClick={() => act(k, onApprove, 'Approved — it’s live.')}>Approve</button>
    </div>
  );

  return (
    <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 40 }}>
      <section>
        <h3 style={{ marginBottom: 6 }}>New guides · {articles.length}</h3>
        {articles.map((a) => {
          const k = `a${a.id}`;
          return (
            <div key={a.id} className="row-rule" style={{ padding: '18px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ font: '600 20px/1.3 var(--font-heading)' }}>{a.title}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>by @{a.starter?.handle} · {agoLong(a.created_at)}</span>
              </div>
              {a.dek && <div style={{ fontStyle: 'italic', color: 'var(--color-neutral-800)', marginTop: 4 }}>{a.dek}</div>}
              <button className="btn btn-ghost" onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Hide' : 'Read'} the guide</button>
              {open === k && <div style={{ background: 'var(--color-surface)', padding: '14px 18px', borderRadius: 2, marginTop: 8 }}><Markdown source={a.body || '*Empty*'} size={16} /></div>}
              <Actions k={k} onApprove={() => reviewArticle(supabaseBrowser(), a.id, true, notes[k])} onReject={() => reviewArticle(supabaseBrowser(), a.id, false, notes[k])} />
            </div>
          );
        })}
        {!articles.length && <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic', padding: '12px 0' }}>No new guides waiting.</div>}
      </section>
      <section>
        <h3 style={{ marginBottom: 6 }}>Suggested edits · {revisions.length}</h3>
        {revisions.map((r) => {
          const k = `r${r.id}`;
          return (
            <div key={r.id} className="row-rule" style={{ padding: '18px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Link href={`/wiki/${r.article.slug}`} style={{ font: '600 18px/1.3 var(--font-heading)' }}>{r.article.title}</Link>
                {r.delta_words != null && <Tag tone={r.delta_words >= 0 ? 'accent' : 'accent2'}>{r.delta_words >= 0 ? '+' : '−'}{Math.abs(r.delta_words)} words</Tag>}
              </div>
              <div style={{ fontSize: 14.5, marginTop: 4 }}><b>@{r.editor.handle}</b> {r.summary} <span style={{ color: 'var(--color-neutral-700)', fontSize: 13 }}>· {agoLong(r.created_at)}</span></div>
              <button className="btn btn-ghost" onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Hide' : 'Compare'} versions</button>
              {open === k && (
                <div className="grid-2" style={{ gap: 16, marginTop: 8 }}>
                  <div><div className="label-caps">Current</div><div style={{ background: 'var(--color-surface)', padding: '12px 16px', borderRadius: 2, maxHeight: 420, overflow: 'auto' }}><Markdown source={r.article.body} size={15} /></div></div>
                  <div><div className="label-caps">Suggested</div><div style={{ background: 'var(--color-accent-100)', padding: '12px 16px', borderRadius: 2, maxHeight: 420, overflow: 'auto' }}><Markdown source={r.body ?? ''} size={15} /></div></div>
                </div>
              )}
              <Actions k={k} onApprove={() => reviewRevision(supabaseBrowser(), r.id, true, notes[k])} onReject={() => reviewRevision(supabaseBrowser(), r.id, false, notes[k])} />
            </div>
          );
        })}
        {!revisions.length && <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic', padding: '12px 0' }}>No edits waiting.</div>}
      </section>
    </div>
  );
}
