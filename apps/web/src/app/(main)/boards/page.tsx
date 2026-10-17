import Link from 'next/link';
import { agoLong, compact, flair, getBoardsIndex, getConfig, markBoardsSeen, n, type Tone } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Avatar, CmykNum, Tag, TONE_CSS, pad2 } from '@/components/ui';
import { OnlineCount } from '@/components/shell/Shell';
import { WhosOnline } from '@/components/WhosOnline';
import { boardHref, threadHref } from '@/lib/routes';

export const metadata = { title: 'The Boards' };

export default async function BoardsPage() {
  const { sb, me } = await currentUser();
  const [d, config] = await Promise.all([getBoardsIndex(sb), getConfig(sb)]);
  if (me) await markBoardsSeen(sb, me.userId);
  const big = d.categories.slice(0, 2);
  const small = d.categories.slice(2);
  const boardsIn = (id: number) => d.boards.filter((b) => b.category_id === id).sort((a, b) => a.sort - b.sort);

  return (
    <>
      <div className="flex-wrap-row px" style={{ paddingTop: 36 }}>
        <div>
          <h1 className="display" style={{ fontSize: 54, margin: 0, letterSpacing: '-.03em' }}>The Boards</h1>
          <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>
            {spell(d.categories.length)} categories, {spell(d.boards.length).toLowerCase()} boards — every corner of campus life has one.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 36, paddingBottom: 6 }}>
          <Stat v={n(d.members)} l="members" />
          <Stat v={compact(d.posts)} l="posts" />
          <Stat v={<OnlineCount />} l="online now" accent />
        </div>
      </div>

      {big.map((c, ci) => {
        const t = TONE_CSS[c.tone as Tone];
        return (
          <section key={c.id} id={c.slug} className="px" style={{ paddingTop: ci === 0 ? 40 : 36 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, borderBottom: `3px solid ${t.main}`, paddingBottom: 10 }}>
              <CmykNum size={64} tracking="0">{pad2(c.id)}</CmykNum>
              <div style={{ paddingBottom: 4 }}>
                <h3 style={{ margin: 0, color: t.heading }}>{c.name}</h3>
                <div style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{c.subtitle}</div>
              </div>
              {ci === 0 && (
                <div className="board-cols" style={{ marginLeft: 'auto', display: 'grid', gridTemplateColumns: '90px 90px 270px', gap: 16, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', paddingBottom: 4 }}>
                  <span style={{ textAlign: 'right' }}>Threads</span><span style={{ textAlign: 'right' }}>Posts</span><span>Latest</span>
                </div>
              )}
            </div>
            {boardsIn(c.id).map((b, i, arr) => (
              <div key={b.id} className={`board-row${i < arr.length - 1 ? ' row-rule' : ''}`}>
                <span style={{ width: 48, height: 48, borderRadius: 2, background: t.tint, color: t.tileFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={b.icon} size={26} />
                </span>
                <div>
                  <Link href={boardHref(b)} className="title-link" style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 19px var(--font-heading)', flexWrap: 'wrap' }}>
                    {b.name}
                    {b.verified_only && <Icon name="seal-check" size={17} color="var(--color-accent)" />}
                    {b.newCount > 0 && <Tag tone="accent2">{b.newCount} new</Tag>}
                  </Link>
                  {b.description && <div style={{ fontSize: 14.5, color: 'var(--color-neutral-800)', marginTop: 2 }}>{b.description}</div>}
                  {b.children.length > 0 && (
                    <div style={{ display: 'flex', gap: 14, fontSize: 13, marginTop: 6, flexWrap: 'wrap' }}>
                      {b.children.slice(0, 7).map((ch) => <Link key={ch.id} href={`/b/${ch.slug}`}>{ch.short_name ?? ch.name}</Link>)}
                      {b.children.length > 7 && <Link href={boardHref(b)}>+{b.children.length - 7} more</Link>}
                    </div>
                  )}
                </div>
                <span className="bc-num" style={{ textAlign: 'right', font: '600 17px var(--font-heading)' }}>{n(b.thread_count)}</span>
                <span className="bc-num" style={{ textAlign: 'right', fontSize: 15, color: 'var(--color-neutral-700)' }}>{compact(b.post_count)}</span>
                <div className="bc-latest" style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                  {b.latest ? (
                    <>
                      <Avatar person={b.latest.author} society={b.latest.society} size={30} />
                      <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                        <Link href={threadHref(b.latest)} className="title-link ellipsis" style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{b.latest.title}</Link>
                        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>@{b.latest.author.handle} · {agoLong(b.latest.created_at)}</div>
                      </div>
                    </>
                  ) : <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No threads yet</span>}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      <div className="px grid-3" style={{ paddingTop: 36, gap: 40 }}>
        {small.map((c) => {
          const t = TONE_CSS[c.tone as Tone];
          return (
            <section key={c.id} id={c.slug}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, borderBottom: `3px solid ${t.main}`, paddingBottom: 8 }}>
                <span style={{ font: '600 34px/0.9 var(--font-heading)', color: t.strong }}>{pad2(c.id)}</span>
                <h4 style={{ margin: 0 }}>{c.name}</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {boardsIn(c.id).map((b) => (
                  <Link key={b.id} href={boardHref(b)} className="title-link" style={{ display: 'flex', gap: 12 }}>
                    <Icon name={b.icon} size={24} color={c.tone === 'ink' ? undefined : t.main} />
                    <div>
                      <div style={{ font: '600 16px var(--font-heading)' }}>
                        {b.name}{b.link_screen === 'societies' && <span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-700)' }}> · verified</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                        {b.thread_count > 0 && !b.link_screen ? `${n(b.thread_count)} threads · ${compact(b.post_count)} posts` : b.description}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <WhosOnline
        newest={d.newest ? { handle: d.newest.handle, flair: flair(d.newest.branch_code, d.newest.grad_year) } : null}
        record={{ n: config?.record_online ?? 0, label: config?.record_label ?? null }}
      />
    </>
  );
}

function Stat({ v, l, accent }: { v: React.ReactNode; l: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ font: '600 30px/1 var(--font-heading)', color: accent ? 'var(--color-accent-700)' : undefined }}>{v}</div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{l}</div>
    </div>
  );
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-one', 'Twenty-two'];
function spell(x: number) { return (WORDS[x] ?? String(x)).replace(/^./, (c) => c.toUpperCase()); }
