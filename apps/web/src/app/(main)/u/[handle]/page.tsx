import Link from 'next/link';
import { notFound } from 'next/navigation';
import { agoLong, compact, flair, getDrafts, getProfile, getSaved, n, yearLabel } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Avatar, CmykNum, Seal, Tag } from '@/components/ui';
import { ThreadRow } from '@/components/ThreadRow';
import { OpenToTeams, ProfileButtons } from '@/components/ProfileClient';

const ACT_ICON: Record<string, string> = { accepted: 'check-circle', upload: 'file-pdf', thread: 'chat-circle', wiki_edit: 'pencil-simple-line', team: 'users-three', reply: 'chat-circle' };
const BAR = ['var(--color-accent-2)', 'var(--color-accent)', 'var(--color-neutral-600)', 'var(--color-accent)', 'var(--color-accent-2)', 'var(--color-neutral-600)'];

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${decodeURIComponent(handle)}` };
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ handle }, { tab = 'activity' }] = await Promise.all([params, searchParams]);
  const { sb, me } = await currentUser();
  const d = await getProfile(sb, decodeURIComponent(handle));
  if (!d) notFound();
  const p = d.profile;
  const mine = me?.userId === p.id;
  const [saved, drafts] = mine ? await Promise.all([getSaved(sb, p.id), getDrafts(sb)]) : [[], []];
  const f = flair(p.branch_code, p.grad_year);
  const yl = yearLabel(p.semester);
  const max = Math.max(1, ...d.karmaBreakdown.map((k) => k.amount));
  const tabs: [string, string][] = [['activity', 'Activity'], ['threads', 'Threads'], ['replies', 'Replies'], ['uploads', 'Uploads'], ...(mine ? [['saved', `Saved · ${saved.length}`], ['drafts', `Drafts · ${drafts.length}`]] as [string, string][] : [])];
  const joined = new Date(p.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  return (
    <>
      <div className="flex-wrap-row px" style={{ paddingTop: 44, gap: '28px 40px' }}>
        <Avatar person={p} size={112} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="display" style={{ fontSize: 46, margin: 0, letterSpacing: '-.025em' }}>@{p.handle}</h1>
            {f && <Tag style={{ fontSize: 13, padding: '4px 10px' }}>{f}</Tag>}
            {yl && <Tag tone="accent" style={{ fontSize: 13, padding: '4px 10px' }}>{yl}</Tag>}
          </div>
          {p.bio && <div style={{ font: 'italic 400 18px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 8, maxWidth: 560 }}>{p.bio}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12, fontSize: 13.5, color: 'var(--color-neutral-700)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="calendar-blank" size={17} />Joined {joined}</span>
            {p.hostel && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="buildings" size={17} />{p.hostel}</span>}
            {p.github && <a href={`https://github.com/${p.github}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="github-logo" size={17} />{p.github}</a>}
            {p.linkedin && <a href={`https://www.linkedin.com/in/${p.linkedin}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="linkedin-logo" size={17} />LinkedIn</a>}
          </div>
        </div>
        {mine && <ProfileButtons profile={p} />}
      </div>

      <div className="px" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 48, paddingTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <CmykNum size={72} tracking="-.03em">{n(p.karma)}</CmykNum>
          <div style={{ paddingBottom: 6, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.3 }}>karma<br /><span style={{ color: 'var(--color-accent-700)', fontWeight: 600 }}>{d.karmaWeek >= 0 ? '+' : ''}{d.karmaWeek} this week</span></div>
        </div>
        {([[p.thread_count, 'threads'], [p.reply_count, 'replies'], [p.accepted_count, 'accepted answers', true], [p.upload_count, 'Library uploads'], [p.download_count, 'downloads of your files']] as [number, string, boolean?][]).map(([v, l, acc]) => (
          <div key={l}><div style={{ font: '600 30px/1 var(--font-heading)', color: acc ? 'var(--color-accent-700)' : undefined }}>{n(v)}</div><div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 5 }}>{l}</div></div>
        ))}
      </div>

      <div className="grid-side-320 px" style={{ paddingTop: 44 }}>
        <div style={{ minWidth: 0 }}>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 26, font: '600 16px var(--font-heading)', borderBottom: '1px solid var(--color-divider)', overflowX: 'auto' }}>
            {tabs.map(([k, l]) => (
              <Link key={k} href={k === 'activity' ? `/u/${p.handle}` : `/u/${p.handle}?tab=${k}`} scroll={false}
                style={{ whiteSpace: 'nowrap', paddingBottom: 10, marginBottom: -1, borderBottom: k === tab ? '2px solid var(--color-accent)' : '2px solid transparent', color: k === tab ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>{l}</Link>
            ))}
          </div>
          {tab === 'activity' && d.activities.map((a) => (
            <Link key={a.id} href={a.route} className="row-rule title-link" style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 14, padding: '18px 0' }}>
              <Icon name={ACT_ICON[a.kind] ?? 'chat-circle'} size={22} color="var(--color-accent)" />
              <div>
                <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', fontWeight: 600 }}>{a.kicker}</div>
                <div style={{ font: '600 18px/1.3 var(--font-heading)', marginTop: 4 }}>{a.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{agoLong(a.created_at)}{a.meta && ` · ${a.meta}`}</div>
              </div>
            </Link>
          ))}
          {tab === 'threads' && d.threads.map((t) => <ThreadRow key={t.id} t={t} />)}
          {tab === 'saved' && saved.map((t) => <ThreadRow key={t.id} t={t} />)}
          {tab === 'replies' && d.replies.map((r) => (
            <Link key={r.id} href={`/t/${r.thread.id}`} className="row-rule title-link" style={{ display: 'block', padding: '16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Re: {r.thread.title}</div>
              <div style={{ fontSize: 16, lineHeight: 1.55, marginTop: 4 }}>{r.body.length > 220 ? r.body.slice(0, 219) + '…' : r.body}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{agoLong(r.created_at)} · {r.score} votes</div>
            </Link>
          ))}
          {tab === 'uploads' && d.uploads.map((u) => (
            <Link key={u.id} href={`/library/subject/${u.subject_code}`} className="row-rule title-link" style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 14, padding: '16px 0' }}>
              <Icon name={u.kind === 'pyq' ? 'file-pdf' : 'file-text'} size={22} color="var(--color-accent)" />
              <div><div style={{ font: '600 17px/1.3 var(--font-heading)' }}>{u.title}</div><div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{u.subject_code} · {compact(u.downloads)} downloads</div></div>
            </Link>
          ))}
          {tab === 'drafts' && drafts.map((dr) => (
            <Link key={dr.id} href={`/new?draft=${dr.id}`} className="row-rule title-link" style={{ display: 'block', padding: '16px 0' }}>
              <div style={{ font: '600 17px/1.3 var(--font-heading)' }}>{dr.title || 'Untitled draft'}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{dr.kind} · saved {agoLong(dr.updated_at)}</div>
            </Link>
          ))}
          {((tab === 'activity' && !d.activities.length) || (tab === 'threads' && !d.threads.length) || (tab === 'replies' && !d.replies.length) || (tab === 'uploads' && !d.uploads.length) || (tab === 'saved' && !saved.length) || (tab === 'drafts' && !drafts.length)) &&
            <div style={{ padding: '24px 0', color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>Nothing here yet.</div>}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {d.karmaBreakdown.length > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px' }}>
              <h4 style={{ margin: '0 0 14px' }}>Where the karma comes from</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {d.karmaBreakdown.map((k, i) => (
                  <div key={k.bucket}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>{k.bucket}</span><b>{n(k.amount)}</b></div>
                    <div style={{ height: 6, background: 'var(--color-neutral-200)', marginTop: 6, borderRadius: 1 }}>
                      <div style={{ height: '100%', width: `${Math.round((k.amount / max) * 72)}%`, background: BAR[i % BAR.length], borderRadius: 1 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <OpenToTeams profile={p} editable={mine} />
          {d.societies.length > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px' }}>
              <h4 style={{ margin: '0 0 14px' }}>Societies</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {d.societies.map((s) => (
                  <div key={s.society.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar society={s.society} size={34} />
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 4 }}>{s.society.name} {s.society.verified && <Seal />}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{s.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {d.badges.length > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px' }}>
              <h4 style={{ margin: '0 0 12px' }}>Badges</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12.5, textAlign: 'center' }}>
                {d.badges.map((b) => (
                  <div key={b.id} style={{ width: 72 }}><Icon name={b.icon} size={30} color={b.tone === 'accent2' ? 'var(--color-accent-2)' : 'var(--color-accent)'} style={{ margin: '0 auto' }} /><div>{b.label}</div></div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
