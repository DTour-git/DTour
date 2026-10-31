import Link from 'next/link';
import {
  ago, clock, dayOfMonth, deadlineText, getConfig, getToday, markdownExcerpt, n, POST_KIND_LABEL, postKindTone, timelineTime, weekOfSem, weekdayShort,
  type FeedTab, type ThreadCard, type Tone,
} from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { CmykNum, FlairTag, Halftone, Seal, Tag, TONE_CSS, pad2 } from '@/components/ui';
import { threadHref } from '@/lib/routes';
import { Formula } from '@/components/Formula';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'hot', label: 'Hot' }, { id: 'new', label: 'New' }, { id: 'top', label: 'Top this week' }, { id: 'branch', label: 'My branch' },
];

function deskMeta(t: ThreadCard) {
  if (t.kind === 'poll') return `${n(t.score)} votes${t.poll_pct ? ` · ${t.poll_pct}%` : ''}`;
  if (t.score > 0) return `${n(t.score)} votes · ${n(t.reply_count)} replies`;
  return `${n(t.reply_count)} replies`;
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = (TABS.find((t) => t.id === rawTab)?.id ?? 'hot') as FeedTab;
  const { sb, me } = await currentUser();
  const [d, config] = await Promise.all([getToday(sb, tab, me?.profile.branch_code ?? null), getConfig(sb)]);
  const week = config ? weekOfSem(config.sem_start) : null;
  const f = d.featured;

  return (
    <>
      {/* Lead row */}
      <section className="grid-lead px" style={{ paddingTop: 36 }}>
        <div>
          {d.lead ? (
            <>
              <div className="kicker" style={{ color: 'var(--color-accent-2-700)' }}>Pata hai aaj kya hua? · {clock(d.lead.created_at, false)}</div>
              <h1 className="display" style={{ fontSize: 46, lineHeight: 1.06, margin: '12px 0 14px', textWrap: 'balance' }}>
                <Link href={threadHref(d.lead)} className="title-link">{d.lead.title}</Link>
              </h1>
              {d.lead.standfirst && <p style={{ font: 'italic 400 19px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', maxWidth: 620, margin: '0 0 20px' }}>{d.lead.standfirst}</p>}
              <Halftone height={280} label={d.lead.image_label} src={d.lead.image_path} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 13, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
                <span>Posted by <b style={{ color: 'var(--color-text)' }}>@{d.lead.author.handle}</b> {d.lead.society?.verified && <Seal />}</span>
                <span>{n(d.lead.reply_count)} replies</span>
                <Link href={threadHref(d.lead)} style={{ marginLeft: 'auto', fontWeight: 600 }}>Join the thread →</Link>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 17, color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No verified news yet today.</div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <CmykNum size={104}>{dayOfMonth()}</CmykNum>
            <div style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
                {weekdayShort()}{week ? ` · Week ${week} of ${config?.sem_label}` : ''}
              </div>
              <div style={{ font: '600 28px/1.05 var(--font-heading)' }}>Today at DTU</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
            {d.timeline.map((e, i) => {
              const href = e.thread_id ? `/t/${e.thread_id}` : e.society_post_id ? '/societies' : null;
              const body = (
                <div>
                  <div style={{ font: '600 16.5px/1.3 var(--font-heading)', color: 'var(--color-text)' }}>{e.title}</div>
                  {e.sub && <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{e.sub}</div>}
                </div>
              );
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '54px 14px minmax(0,1fr)', gap: 10, paddingBottom: i < d.timeline.length - 1 ? 18 : 0 }}>
                  <span style={{ fontSize: 12.5, textAlign: 'right', color: e.state === 'now' ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)', fontWeight: e.state === 'now' ? 600 : 400 }}>
                    {e.state === 'now' ? 'NOW' : timelineTime(e.starts_at)}
                  </span>
                  <span style={{
                    width: 10, height: 10, marginTop: 5, borderRadius: '50%',
                    ...(e.state === 'past' ? { background: 'var(--color-neutral-500)' } : e.state === 'now' ? { background: 'var(--color-accent-2)' } : { border: '2px solid var(--color-accent)' }),
                  }} />
                  {href ? <Link href={href} className="title-link">{body}</Link> : body}
                </div>
              );
            })}
            {!d.timeline.length && <div style={{ fontSize: 15, color: 'var(--color-neutral-700)' }}>Nothing on the calendar today.</div>}
          </div>
        </div>
      </section>

      {/* From the boards */}
      <section className="px" style={{ paddingTop: 72 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px 24px' }}>
          <h2 style={{ margin: 0 }}>From the boards</h2>
          <div style={{ display: 'flex', gap: 20, font: '600 15px var(--font-heading)', flexWrap: 'wrap' }} role="tablist">
            {TABS.map((t) => (
              <Link key={t.id} href={t.id === 'hot' ? '/' : `/?tab=${t.id}`} scroll={false} role="tab" aria-selected={t.id === tab}
                style={{ paddingBottom: 3, borderBottom: t.id === tab ? '2px solid var(--color-accent)' : '2px solid transparent', color: t.id === tab ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>
                {t.label}
              </Link>
            ))}
          </div>
          <Link href="/boards" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600 }}>All {d.boardCount} boards →</Link>
        </div>

        <div className="grid-feature" style={{ marginTop: 34 }}>
          {f ? (
            <Link href={threadHref(f)} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 18, color: 'var(--color-text)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-neutral-700)' }}>
                <Icon name="arrow-fat-up" size={26} color="var(--color-accent)" />
                <span style={{ font: '600 20px var(--font-heading)', color: 'var(--color-text)' }}>{n(f.score)}</span>
                <span style={{ fontSize: 11 }}>votes</span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
                  <CategoryTag thread={f} /><b style={{ color: 'var(--color-text)' }}>@{f.author.handle}</b><FlairTag person={f.author} />{ago(f.created_at)}
                </div>
                <h3 style={{ fontSize: 32, lineHeight: 1.14, margin: '12px 0 10px', textWrap: 'balance' }}>{f.title}</h3>
                <p className="feed-excerpt" style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--color-neutral-800)', margin: 0, maxWidth: 600, overflow: 'hidden' }}>
                  {f.standfirst ?? markdownExcerpt(f.body).map((part, i) => {
                    switch (part.t) {
                      case 'math': return <Formula key={i} source={part.v} />;
                      case 'b': return <b key={i}>{part.v}</b>;
                      case 'i': return <i key={i}>{part.v}</i>;
                      case 'code': return <code key={i}>{part.v}</code>;
                      // The whole card is already a link to the thread.
                      case 'link': return <span key={i} style={{ textDecoration: 'underline' }}>{part.v}</span>;
                      default: return <span key={i}>{part.v}</span>;
                    }
                  })}
                </p>
                <div style={{ display: 'flex', gap: 22, marginTop: 14, fontSize: 14, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="chat-circle" size={18} />{n(f.reply_count)} replies</span>
                  {f.attachment && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="file-pdf" size={18} color="var(--color-accent-2)" />{f.tags.includes('PYQ') ? 'PYQ sheet' : 'Attachment'}</span>}
                  {f.accepted_reply_id && <AcceptedBy threadId={f.id} />}
                </div>
              </div>
            </Link>
          ) : <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No threads here yet.</div>}
          {d.guide && (
            <Link href={`/wiki/${d.guide.slug}`} style={{ color: 'var(--color-text)' }}>
              <Halftone height={150} src={d.guide?.cover_path} label={d.guide?.cover_label} />
              <div className="kicker" style={{ color: 'var(--color-accent-700)', marginTop: 14 }}>Wiki guide</div>
              <div style={{ font: '600 23px/1.18 var(--font-heading)', marginTop: 6 }}>{d.guide.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 6 }}>{d.guide.editor_count} editors{d.guide.checked_at ? ' · checked by a senior' : ''}</div>
            </Link>
          )}
        </div>

        {/* Board desks */}
        <div className="grid-4" style={{ gap: 20, marginTop: 56 }}>
          {d.desks.map((desk, i) => {
            const t = TONE_CSS[desk.category.tone as Tone];
            return (
              <div key={desk.category.id} style={{ background: 'var(--color-surface)', borderTop: `3px solid ${t.main}`, borderRadius: 2, padding: '18px 22px 22px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ font: '600 14px var(--font-heading)', color: t.strong }}>{pad2(i + 1)}</span>
                  <span style={{ font: '600 19px var(--font-heading)' }}>{desk.category.name}</span>
                  <Icon name={desk.category.icon} size={22} color={t.main} style={{ marginLeft: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 18, flex: 1 }}>
                  {desk.threads.map((th) => (
                    <Link key={th.id} href={threadHref(th)} className="title-link">
                      <div style={{ font: '600 17px/1.3 var(--font-heading)' }}>{th.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 5 }}>{deskMeta(th)}</div>
                    </Link>
                  ))}
                  {!desk.threads.length && <div style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Quiet for now.</div>}
                </div>
                <Link href={`/boards#${desk.category.slug}`} style={{ display: 'block', marginTop: 18, fontSize: 14, fontWeight: 600 }}>More in {desk.category.name} →</Link>
              </div>
            );
          })}
        </div>

        {/* Two-up boxes */}
        <div className="grid-2" style={{ gap: 20, marginTop: 20, alignItems: 'stretch' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="users-three" size={22} color="var(--color-accent)" /><h4 style={{ margin: 0 }}>Teams looking for you</h4>
              <Link href="/teams" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600 }}>{d.openTeamCount} open →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 18 }}>
              {d.teams.map((t) => {
                const open = t.team_roles.filter((r) => !r.filled).sort((a, b) => a.sort - b.sort);
                return (
                  <Link key={t.id} href="/teams" className="title-link">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ font: '600 18px/1.3 var(--font-heading)' }}>{t.short_title ?? t.title}</div>
                      <span style={{ fontSize: 13, whiteSpace: 'nowrap', color: t.urgent ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)', fontWeight: t.urgent ? 600 : 400 }}>{deadlineText(t.deadline_on, t.deadline_label)}</span>
                    </div>
                    {open.length > 0 && (
                      <div style={{ fontSize: 14, color: 'var(--color-neutral-800)', marginTop: 4 }}>
                        Needs {open.map((r, k) => <span key={r.name}>{k > 0 && ', '}<b>{r.name}</b></span>)}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="map-pin" size={22} color="var(--color-accent)" /><h4 style={{ margin: 0 }}>Kahan chalein?</h4>
              <Link href="/kahan-chalein" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600 }}>See all →</Link>
            </div>
            <div className="grid-3" style={{ gap: 16, marginTop: 18 }}>
              {d.picks.map((p) => (
                <Link key={p.id} href="/kahan-chalein" className="title-link">
                  <Halftone height={90} src={p.image_path} />
                  <div style={{ font: '600 15.5px var(--font-heading)', marginTop: 8 }}>{p.short_name ?? p.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{p.home_meta ?? p.where_label}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Society board strip */}
      <section className="px" style={{ paddingTop: 72 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px 24px' }}>
          <h2 style={{ margin: 0 }}>Society board</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/societies?kind=event"><Tag tone="accent2">Events</Tag></Link>
            <Link href="/societies?kind=recruiting"><Tag>Recruitments</Tag></Link>
            <Link href="/societies?kind=workshop"><Tag>Workshops</Tag></Link>
            <Link href="/societies?kind=talk"><Tag>Talks</Tag></Link>
          </div>
          <Link href="/societies" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600 }}>All {d.societyCount} societies →</Link>
        </div>
        <div className="grid-4" style={{ gap: 40, marginTop: 28 }}>
          {d.posts.map((p) => (
            <Link key={p.id} href="/societies" className="title-link">
              <div className="kicker" style={{ color: postKindTone(p.kind) === 'accent2' ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)' }}>
                {POST_KIND_LABEL[p.kind]} · {p.short_when ?? p.when_label}
              </div>
              <div style={{ font: '600 19px/1.25 var(--font-heading)', margin: '6px 0' }}>{p.title}{p.kind === 'workshop' && p.where_label ? `, ${p.where_label}` : ''}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {p.society.short_name ?? p.society.name} {p.society.verified && <Icon name="seal-check" size={15} color="var(--color-accent)" />} · {p.kind === 'recruiting' ? 'Apply' : `${n(p.rsvp_count)} ${p.rsvp_word}`}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function CategoryTag({ thread }: { thread: ThreadCard }) {
  const tone = { 1: 'accent', 2: 'accent2', 3: 'accent', 4: 'accent2', 5: 'neutral' }[thread.board.category_id] as 'accent' | 'accent2' | 'neutral';
  const cat = ['', 'Campus', 'Padhai', 'Career', 'Culture', 'Bahar'][thread.board.category_id];
  const root = thread.board.parent_id ? null : thread.board.name;
  return <Tag tone={tone}>{cat} · {root ?? boardRootName(thread)}</Tag>;
}

function boardRootName(t: ThreadCard) {
  // Sub-boards of Academics ("COE · 3rd sem") read as "Academics" in the tag.
  return t.board.category_id === 2 ? 'Academics' : t.board.short_name ?? t.board.name;
}

async function AcceptedBy({ threadId }: { threadId: number }) {
  const { sb } = await currentUser();
  const { data } = await sb.from('threads').select('accepted:replies!threads_accepted_fk(society:societies(name),author:profiles!replies_author_id_fkey(handle))').eq('id', threadId).single();
  const a = (data as unknown as { accepted: { society: { name: string } | null; author: { handle: string } } | null })?.accepted;
  if (!a) return null;
  return <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="check-circle" size={18} color="var(--color-accent)" />Answered by {a.society?.name ?? `@${a.author.handle}`}</span>;
}
