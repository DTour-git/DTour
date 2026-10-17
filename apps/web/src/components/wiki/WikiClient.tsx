'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { n, postWikiTalk, setWikiFeedback, suggestWikiEdit } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { useShell } from '../shell/Shell';

export function Useful({ articleId, count, mine }: { articleId: number; count: number; mine: boolean | null }) {
  const { me } = useShell();
  const [m, setM] = useState(mine);
  const [c, setC] = useState(count);
  const set = async (useful: boolean) => {
    const next = m === useful ? null : useful;
    setC(c + (next === true ? 1 : 0) - (m === true ? 1 : 0));
    setM(next);
    await setWikiFeedback(supabaseBrowser(), articleId, me.id, next);
  };
  return (
    <>
      <button className="vote-btn" onClick={() => set(true)} aria-pressed={m === true} style={{ alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)' }}>
        <Icon name="thumbs-up" size={19} weight={m === true ? 'fill' : 'duotone'} />{n(c)}
      </button>
      <button className="vote-btn" onClick={() => set(false)} aria-pressed={m === false} aria-label="Not useful">
        <Icon name="thumbs-down" size={19} weight={m === false ? 'fill' : 'duotone'} />
      </button>
    </>
  );
}

export function EditForm({ articleId, body, slug }: { articleId: number; body: string; slug: string }) {
  const { me, toast } = useShell();
  const router = useRouter();
  const [text, setText] = useState(body);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!summary.trim()) { toast('Add a one-line summary of your edit.'); return; }
    setBusy(true);
    try {
      await suggestWikiEdit(supabaseBrowser(), { articleId, userId: me.id, summary: summary.trim(), body: text, oldBody: body });
      toast('Edit published — you’re credited as an editor.');
      router.push(`/wiki/${slug}`); router.refresh();
    } catch (e) { toast((e as Error).message); setBusy(false); }
  };
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--color-neutral-700)', marginBottom: 10 }}>Markdown: <code>### Heading</code>, <code>**bold**</code>, <code>[link](url)</code>, and <code>&gt; [!senior] "quote" — @handle</code> for a senior’s tip.</div>
      <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 460, font: '400 15px/1.6 ui-monospace, Menlo, monospace' }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <input className="input" placeholder="What did you change? e.g. “added IT lab tips”" value={summary} onChange={(e) => setSummary(e.target.value)} style={{ height: 40 }} />
        <button className="btn btn-primary" disabled={busy} onClick={save} style={{ whiteSpace: 'nowrap' }}><Icon name="pencil-simple-line" size={17} />Publish edit</button>
      </div>
    </div>
  );
}

export function TalkForm({ articleId }: { articleId: number }) {
  const { me } = useShell();
  const router = useRouter();
  const [body, setBody] = useState('');
  const post = async () => {
    if (!body.trim()) return;
    await postWikiTalk(supabaseBrowser(), articleId, me.id, body.trim());
    setBody(''); router.refresh();
  };
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
      <input className="input" placeholder="Start a discussion about this guide…" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} style={{ height: 42 }} />
      <button className="btn btn-primary" onClick={post}>Post</button>
    </div>
  );
}
