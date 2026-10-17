import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { compact, getBoard, n, type FeedTab, type Tone } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { CmykNum, H6, TONE_CSS, pad2 } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ThreadRow } from '@/components/ThreadRow';
import { OnlineCount, PresenceBoard } from '@/components/shell/Shell';
import { JoinBoard } from '@/components/thread/ThreadActions';
import { boardHref } from '@/lib/routes';

const TABS: [FeedTab, string][] = [['hot', 'Hot'], ['new', 'New'], ['top', 'Top this week']];

export default async function BoardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab: raw }] = await Promise.all([params, searchParams]);
  const tab = (TABS.find(([k]) => k === raw)?.[0] ?? 'hot') as FeedTab;
  const { sb, me } = await currentUser();
  const d = await getBoard(sb, slug, tab);
  if (!d) notFound();
  if (d.board.link_screen) redirect(boardHref(d.board));
  const t = TONE_CSS[d.category.tone as Tone];
  const { data: joined } = me ? await sb.from('board_members').select('board_id').eq('board_id', d.board.id).eq('user_id', me.userId).maybeSingle() : { data: null };

  return (
    <div className="px" style={{ paddingTop: 28 }}>
      <PresenceBoard slug={slug} />
      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
        <Link href="/boards">Boards</Link>
        {d.path.slice(0, -1).map((b) => <span key={b.id}> / <Link href={`/b/${b.slug}`}>{b.short_name ?? b.name}</Link></span>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, borderBottom: `3px solid ${t.main}`, paddingBottom: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <CmykNum size={64} tracking="0">{pad2(d.category.id)}</CmykNum>
        <div style={{ paddingBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 40, letterSpacing: '-.025em', color: t.heading }}>{d.board.name}</h1>
          {d.board.description && <div style={{ fontSize: 15, color: 'var(--color-neutral-700)' }}>{d.board.description}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 28, paddingBottom: 6, alignItems: 'flex-end' }}>
          <div><div style={{ font: '600 24px/1 var(--font-heading)' }}>{n(d.board.thread_count)}</div><div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>threads</div></div>
          <div><div style={{ font: '600 24px/1 var(--font-heading)' }}>{compact(d.board.post_count)}</div><div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>posts</div></div>
          <Link href={`/new?board=${d.board.slug}`} className="btn btn-primary" style={{ color: 'var(--color-bg)' }}><Icon name="pencil-simple-line" size={17} />Post here</Link>
        </div>
      </div>

      <div className="grid-side" style={{ marginTop: 22 }}>
        <div>
          <div style={{ display: 'flex', gap: 20, font: '600 15px var(--font-heading)' }}>
            {TABS.map(([k, l]) => (
              <Link key={k} href={k === 'hot' ? '?' : `?tab=${k}`} scroll={false}
                style={{ paddingBottom: 3, borderBottom: k === tab ? '2px solid var(--color-accent)' : '2px solid transparent', color: k === tab ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>{l}</Link>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            {d.threads.map((th) => <ThreadRow key={th.id} t={th} showBoard={th.board.id !== d.board.id} />)}
            {!d.threads.length && <div style={{ padding: '30px 0', color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No threads yet. <Link href={`/new?board=${d.board.slug}`}>Start the first one →</Link></div>}
          </div>
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div>
            <H6 style={{ marginBottom: 10 }}>About this board</H6>
            <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{n(d.board.member_count)} members · <OnlineCount board={slug} /> online</div>
            <JoinBoard boardId={d.board.id} joined={!!joined} />
          </div>
          {d.children.length > 0 && (
            <div>
              <H6>Sub-boards</H6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
                {d.children.map((c) => <Link key={c.id} href={`/b/${c.slug}`}>{c.short_name ?? c.name}</Link>)}
              </div>
            </div>
          )}
          {d.board.rules.length > 0 && (
            <div>
              <H6>Board rules</H6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-800)' }}>
                {d.board.rules.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
