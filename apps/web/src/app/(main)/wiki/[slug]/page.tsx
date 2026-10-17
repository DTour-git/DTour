import Link from 'next/link';
import { notFound } from 'next/navigation';
import { agoLong, flair, getArticle, headings, parse } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Avatar, H6 } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { EditForm, TalkForm, Useful } from '@/components/wiki/WikiClient';

const TABS = ['read', 'edit', 'history', 'talk'] as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { sb } = await currentUser();
  const { data } = await sb.from('wiki_articles').select('title').eq('slug', slug).maybeSingle();
  return { title: data?.title ?? 'Wiki' };
}

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab: raw }] = await Promise.all([params, searchParams]);
  const tab = TABS.find((t) => t === raw) ?? 'read';
  const { sb, me } = await currentUser();
  const d = await getArticle(sb, slug, me?.userId ?? null);
  if (!d) notFound();
  const a = d.article;
  const toc = headings(parse(a.body));
  const others = Math.max(0, a.editor_count - 2);
  const checked = a.checked_at ? new Date(a.checked_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null;
  const label = { read: 'Read', edit: 'Edit', history: 'History', talk: `Talk · ${a.talk_count}` };

  return (
    <div className="grid-article px" style={{ paddingTop: 28 }}>
      <aside className="article-toc" style={{ paddingTop: 110 }}>
        {toc.length > 0 && <>
          <H6 style={{ marginBottom: 14 }}>On this page</H6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5, position: 'sticky', top: 20 }}>
            {toc.map((h, i) => <a key={h.id} href={`#${h.id}`} style={i === 0 ? { fontWeight: 600 } : { color: 'var(--color-neutral-800)' }}>{h.text}</a>)}
          </div>
        </>}
      </aside>

      <article style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13.5, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
          <Link href="/wiki">Articles</Link>
          {a.board && <><span>/</span><Link href={`/b/${a.board.slug}`}>{a.board.name}</Link></>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, font: '600 14px var(--font-heading)' }}>
            {TABS.map((t) => (
              <Link key={t} href={t === 'read' ? `/wiki/${slug}` : `/wiki/${slug}?tab=${t}`} scroll={false}
                style={{ padding: '6px 12px', borderBottom: t === tab ? '2px solid var(--color-text)' : '2px solid transparent', color: t === tab ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>{label[t]}</Link>
            ))}
          </div>
        </div>
        <h1 className="display" style={{ fontSize: 52, lineHeight: 1.02, margin: '26px 0 14px', letterSpacing: '-.025em' }}>{a.title}</h1>
        {a.dek && <p style={{ font: 'italic 400 21px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', margin: '0 0 18px', maxWidth: 640 }}>{a.dek}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, fontSize: 13.5, color: 'var(--color-neutral-700)', marginBottom: 34 }}>
          <div style={{ display: 'flex' }}>
            {d.editors.slice(0, 2).map((e, i) => <span key={e.id} style={{ marginLeft: i ? -8 : 0 }}><Avatar person={e} size={28} ring="var(--color-bg)" /></span>)}
            {others > 0 && <span style={{ marginLeft: -8 }}><Avatar person={{ handle: 'x', tint: 'neutral' }} label={`+${others}`} size={28} ring="var(--color-bg)" /></span>}
          </div>
          {a.starter && <span>Started by <b style={{ color: 'var(--color-text)' }}>{a.starter.display_name ?? `@${a.starter.handle}`}</b>{flair(a.starter.branch_code, a.starter.grad_year) && ` (${flair(a.starter.branch_code, a.starter.grad_year)})`} · {a.editor_count} editors · {a.read_minutes} min read</span>}
          {checked && <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-800)' }}><Icon name="shield-check" size={18} color="var(--color-accent)" />Checked by a senior · {checked}</span>}
        </div>

        {tab === 'read' && <>
          <div style={{ maxWidth: 680 }}><Markdown source={a.body} size={18} lineHeight={1.7} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 34, paddingTop: 20, borderTop: '1px solid var(--color-divider)', fontSize: 14, color: 'var(--color-neutral-700)', maxWidth: 680 }}>
            <span>Was this useful?</span>
            <Useful articleId={a.id} count={a.useful_count} mine={d.myFeedback} />
            <Link href={`/wiki/${slug}?tab=edit`} className="btn btn-secondary" style={{ marginLeft: 'auto', color: 'var(--color-text)' }}><Icon name="pencil-simple-line" size={17} />Suggest an edit</Link>
          </div>
        </>}
        {tab === 'edit' && <EditForm articleId={a.id} body={a.body} slug={slug} />}
        {tab === 'history' && (
          <div style={{ maxWidth: 680 }}>
            {d.revisions.map((r) => (
              <div key={r.id} className="row-rule" style={{ padding: '14px 0', fontSize: 15 }}>
                <b>@{r.editor.handle}</b> {r.summary}
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{agoLong(r.created_at)}{r.delta_words != null && <> · <span style={{ color: r.delta_words >= 0 ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)' }}>{r.delta_words >= 0 ? '+' : '−'}{Math.abs(r.delta_words)}</span> words</>}</div>
              </div>
            ))}
            {!d.revisions.length && <div style={{ color: 'var(--color-neutral-700)' }}>No edits yet.</div>}
          </div>
        )}
        {tab === 'talk' && (
          <div style={{ maxWidth: 680 }}>
            <TalkForm articleId={a.id} />
            {d.talk.map((t) => (
              <div key={t.id} className="row-rule" style={{ padding: '14px 0', fontSize: 15, lineHeight: 1.5 }}>
                <b>@{t.author.handle}</b> <span style={{ color: 'var(--color-neutral-700)', fontSize: 13 }}>· {agoLong(t.created_at)}</span>
                <div>{t.body}</div>
              </div>
            ))}
          </div>
        )}
      </article>

      <aside style={{ paddingTop: 110, display: 'flex', flexDirection: 'column', gap: 34 }}>
        <div>
          <H6>Recent edits</H6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.4 }}>
            {d.revisions.slice(0, 3).map((r) => (
              <div key={r.id}><b>@{r.editor.handle}</b> {r.summary}
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{agoLong(r.created_at)}{r.delta_words != null && <> · <span style={{ color: r.delta_words >= 0 ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)' }}>{r.delta_words >= 0 ? '+' : '−'}{Math.abs(r.delta_words)}</span> words</>}</div>
              </div>
            ))}
          </div>
          <Link href={`/wiki/${slug}?tab=history`} style={{ display: 'block', marginTop: 12, fontSize: 14, fontWeight: 600 }}>Full history →</Link>
        </div>
        <div>
          <H6>More guides</H6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, font: '600 15.5px/1.3 var(--font-heading)' }}>
            {d.more.map((m) => <Link key={m.slug} href={`/wiki/${m.slug}`} className="title-link">{m.title}</Link>)}
          </div>
        </div>
        <div>
          <H6>Talk</H6>
          {d.talk[0] && <div style={{ fontSize: 14, lineHeight: 1.45 }}><b>@{d.talk[0].author.handle}</b> <span style={{ fontStyle: 'italic' }}>{d.talk[0].body}</span></div>}
          <Link href={`/wiki/${slug}?tab=talk`} style={{ display: 'block', marginTop: 8, fontSize: 14, fontWeight: 600 }}>Join the discussion · {a.talk_count}</Link>
        </div>
      </aside>
    </div>
  );
}
