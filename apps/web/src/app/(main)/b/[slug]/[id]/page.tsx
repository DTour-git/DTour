import Link from 'next/link';
import { notFound } from 'next/navigation';
import { agoLong, getThread, n, sortReplies } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Avatar, FlairTag, H6, Seal, Tag } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { OnlineCount, PresenceBoard } from '@/components/shell/Shell';
import { DownloadLink, JoinBoard, PollBox, ReplyComposer, ReplyItem, VoteRail } from '@/components/thread/ThreadActions';

const SORTS = [['best', 'Best'], ['newest', 'Newest'], ['oldest', 'Oldest']] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await currentUser();
  const { data } = await sb.from('threads').select('title').eq('id', Number(id)).maybeSingle();
  return { title: data?.title ?? 'Thread' };
}

export default async function ThreadPage({ params, searchParams }: {
  params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ sort?: string }>;
}) {
  const [{ slug, id }, { sort: rawSort }] = await Promise.all([params, searchParams]);
  const sort = (SORTS.find(([k]) => k === rawSort)?.[0] ?? 'best') as 'best' | 'newest' | 'oldest';
  const { sb, me } = await currentUser();
  const d = await getThread(sb, Number(id), me?.userId ?? null);
  if (!d) notFound();
  const t = d.thread;
  const isOp = me?.userId === t.author.id;
  const replies = sortReplies(d.replies, sort, t.accepted_reply_id);
  const [root, ...rest] = d.path;
  const leaf = d.path[d.path.length - 1];

  return (
    <div className="grid-side px" style={{ paddingTop: 28 }}>
      <PresenceBoard slug={slug} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          <Link href="/boards">Boards</Link>
          {root && <> / <Link href={`/b/${root.slug}`}>{root.short_name ?? root.name}</Link></>}
          {rest.length > 0 && <> / <Link href={`/b/${leaf.slug}`}>{leaf.short_name ?? leaf.name}</Link></>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 20, marginTop: 22 }}>
          <VoteRail threadId={t.id} score={t.score} myVote={d.myVote} saved={d.saved} />
          <div style={{ minWidth: 0 }}>
            {t.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.tags.map((tag, i) => <Tag key={tag} tone={i === 0 ? 'accent' : 'neutral'}>{tag}</Tag>)}
              </div>
            )}
            <h1 className="display" style={{ fontSize: 40, lineHeight: 1.1, margin: '14px 0', textWrap: 'balance' }}>{t.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
              <Avatar person={t.author} society={t.kind === 'news' ? null : t.society} size={32} />
              <Link href={`/u/${t.author.handle}`} style={{ color: 'var(--color-text)', fontWeight: 600 }}>@{t.author.handle}</Link>
              {t.society?.verified && <Seal />}
              <FlairTag person={t.author} />
              <span>{n(t.author.karma)} karma</span>
              <span>· {agoLong(t.created_at)}</span>
            </div>
            {t.standfirst && t.kind === 'news' && <p style={{ font: 'italic 400 19px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', margin: '20px 0 0', maxWidth: 680 }}>{t.standfirst}</p>}
            <div style={{ marginTop: 22, maxWidth: 680 }}><Markdown source={t.body} /></div>
            {d.poll && <PollBox threadId={t.id} options={d.poll} mine={d.myPollOption} />}
            {t.attachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--color-surface)', borderRadius: 2, maxWidth: 420 }}>
                <Icon name="file-pdf" size={28} color="var(--color-accent-2)" />
                <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                  {t.attachment.library_item_id
                    ? <DownloadLink itemId={t.attachment.library_item_id} style={{ fontWeight: 600, color: 'var(--color-accent-700)' }}>{t.attachment.name}</DownloadLink>
                    : <b>{t.attachment.name}</b>}
                  <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
                    {t.attachment.size}{t.attachment.subject && <> · also in <Link href={`/library/subject/${t.attachment.subject}`}>Library › {t.attachment.subject}</Link></>}
                  </div>
                </div>
                {t.attachment.library_item_id && <DownloadLink itemId={t.attachment.library_item_id} style={{ marginLeft: 'auto' }}><Icon name="download-simple" size={22} color="var(--color-accent)" /></DownloadLink>}
              </div>
            )}
            {d.fromLounge && <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--color-neutral-700)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="arrow-bend-down-right" size={16} color="var(--color-accent)" />Started in the Lounge</div>}
          </div>
        </div>

        <div className="replies-indent" style={{ marginLeft: 68 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, margin: '48px 0 22px', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0 }}>{n(Math.max(t.reply_count, d.replyCount))} replies</h4>
            {SORTS.map(([k, label]) => (
              <Link key={k} href={k === 'best' ? '?' : `?sort=${k}`} scroll={false}
                style={k === sort ? { font: '600 14px var(--font-heading)', color: 'var(--color-accent-700)' } : { fontSize: 14, color: 'var(--color-neutral-700)' }}>{label}</Link>
            ))}
          </div>
          <div style={{ marginBottom: 34 }}><ReplyComposer threadId={t.id} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {replies.map((r) => <ReplyItem key={r.id} r={r} threadId={t.id} opId={t.author.id} acceptedId={t.accepted_reply_id} isOp={isOp} />)}
            {!replies.length && <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No replies yet. Be the first.</div>}
          </div>
        </div>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 36, paddingTop: 44 }}>
        <div>
          <H6 style={{ marginBottom: 10 }}>About this board</H6>
          <Link href={`/b/${d.board.slug}`} className="title-link" style={{ font: '600 20px var(--font-heading)' }}>{d.board.name}</Link>
          {d.board.description && <p style={{ fontSize: 14.5, color: 'var(--color-neutral-800)', margin: '6px 0 10px' }}>{d.board.description}</p>}
          <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{n(d.board.member_count)} members · <OnlineCount board={slug} /> online</div>
          <JoinBoard boardId={d.board.id} joined={d.joined} />
        </div>
        {d.related.length > 0 && (
          <div>
            <H6>Related in Library</H6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
              {d.related.map((it) => (
                <Link key={it.id} href={`/library/subject/${it.subject_code}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name={it.format === 'Video' ? 'video' : 'file-text'} size={18} />{it.title}
                </Link>
              ))}
            </div>
          </div>
        )}
        {d.wiki && (
          <div>
            <H6>Wiki</H6>
            <Link href={`/wiki/${d.wiki.slug}`} className="title-link"><div style={{ font: '600 17px/1.3 var(--font-heading)' }}>{d.wiki.title}</div></Link>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>
              {d.wiki.editor_count} editors{d.wiki.checked_at && ` · checked ${new Date(d.wiki.checked_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
