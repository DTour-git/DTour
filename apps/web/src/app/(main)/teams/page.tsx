import Link from 'next/link';
import { dayNum, deadlineText, flair, getTeams, matchesSkills, monthShort } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Avatar, Tag } from '@/components/ui';
import { AskToJoin } from '@/components/Toggles';
import { TeamRequests } from '@/components/Manage';

export const metadata = { title: 'Team Up' };
const CATS: [string, string, string][] = [['hackathon', 'Hackathons', 't-accent'], ['project', 'Projects', 't-accent'], ['competition', 'Competitions', 't-accent2'], ['research', 'Research', 't-neutral']];

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ cat?: string; mine?: string }> }) {
  const { cat, mine } = await searchParams;
  const { sb, me } = await currentUser();
  const d = await getTeams(sb, me?.userId ?? null);
  const skills = me?.profile.skills ?? [];
  let teams = cat ? d.teams.filter((t) => t.category === cat) : d.teams;
  if (mine) teams = teams.filter((t) => matchesSkills(t, skills));
  const qs = (next: { cat?: string | null; mine?: boolean }) => {
    const p = new URLSearchParams();
    const c = next.cat === undefined ? cat : next.cat;
    const m = next.mine === undefined ? !!mine : next.mine;
    if (c) p.set('cat', c);
    if (m) p.set('mine', '1');
    const s = p.toString();
    return s ? `/teams?${s}` : '/teams';
  };

  return (
    <>
      <div className="flex-wrap-row px" style={{ paddingTop: 36 }}>
        <div>
          <h1 className="display" style={{ fontSize: 48, margin: 0, letterSpacing: '-.025em' }}>Team Up</h1>
          <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>Find teammates for hackathons, projects and competitions — or put yourself out there.</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Link href={me ? `/u/${me.profile.handle}?edit=teams` : '#'} className="btn btn-secondary" style={{ color: 'var(--color-text)' }}><Icon name="hand-waving" size={17} />I&apos;m looking for a team</Link>
          <Link href="/new?type=team" className="btn btn-primary" style={{ color: 'var(--color-bg)' }}><Icon name="plus" size={17} />Post a team</Link>
        </div>
      </div>
      <div className="pills px" style={{ paddingTop: 24, alignItems: 'center' }}>
        <Link href={qs({ cat: null })} className="pill t-neutral" data-active={!cat}>All · {d.teams.length}</Link>
        {CATS.map(([k, l, cls]) => <Link key={k} href={qs({ cat: k })} className={`pill ${cls}`} data-active={cat === k}>{l} · {d.counts[k] ?? 0}</Link>)}
        {skills.length > 0 && (
          <Link href={qs({ mine: !mine })} style={{ marginLeft: 'auto', font: '400 14px var(--font-body)', color: mine ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: mine ? 600 : 400 }}>
            <Icon name="funnel" size={18} weight={mine ? 'fill' : 'duotone'} />Needs my skills: {skills.slice(0, 2).join(', ')}
          </Link>
        )}
      </div>

      <div className="grid-side px" style={{ paddingTop: 32, gap: 56 }}>
        <div className="grid-2" style={{ gap: 20, alignContent: 'start' }}>
          {teams.map((t, i) => {
            const deadline = deadlineText(t.deadline_on, t.deadline_label);
            return (
              <div key={t.id} className="card" style={{ padding: 22, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <Tag tone={t.event_tone}>{t.event_name}</Tag>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, color: t.urgent ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)' }}>{deadline}</span>
                </div>
                <div style={{ font: '600 21px/1.25 var(--font-heading)' }}>{t.title}</div>
                {t.description && <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-neutral-800)' }}>{t.description}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                  {t.team_roles.map((r) => r.filled
                    ? <span key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--color-neutral-700)' }}><Icon name="check-circle" size={17} />{r.name}</span>
                    : <span key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 14 }}><Icon name="circle-dashed" size={17} color="var(--color-accent)" />{r.name}</span>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
                  <div style={{ display: 'flex' }}>
                    {t.team_members.slice(0, 3).map((m) => <span key={m.user.id} style={{ marginRight: -6 }}><Avatar person={m.user} size={28} ring="var(--color-surface)" /></span>)}
                    {t.extra_members > 0 && <span style={{ marginRight: -6 }}><Avatar person={{ handle: 'x', tint: 'neutral' }} label={`+${t.extra_members}`} size={28} ring="var(--color-surface)" /></span>}
                  </div>
                  {t.owner_id === me?.userId
                    ? <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-neutral-700)' }}>Your team</span>
                    : d.myRequestStatus.get(t.id) === 'accepted'
                      ? <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: 'var(--color-accent-700)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check-circle" size={17} />You&apos;re in</span>
                      : d.myRequestStatus.get(t.id) === 'declined'
                        ? <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-neutral-700)' }}>Request not accepted</span>
                        : <AskToJoin teamId={t.id} requested={d.myRequests.has(t.id)} primary={i === 0} />}
                </div>
                {t.owner_id === me?.userId && (
                  <TeamRequests teamId={t.id} requests={d.requests.get(t.id) ?? []} openRoles={t.team_roles.filter((r) => !r.filled).map((r) => ({ id: r.id, name: r.name }))} />
                )}
              </div>
            );
          })}
          {!teams.length && <div style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No teams match. <Link href="/new?type=team">Post one →</Link></div>}
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div>
            <h4 style={{ margin: '0 0 16px' }}>Upcoming deadlines</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.deadlines.map((x) => (
                <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 12 }}>
                  <div style={{ lineHeight: 1 }}>
                    <div style={{ font: '600 24px var(--font-heading)', color: x.highlight ? 'var(--color-accent-2-700)' : undefined }}>{dayNum(x.on_date + 'T12:00:00+05:30')}</div>
                    <div style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--color-neutral-700)' }}>{monthShort(x.on_date + 'T12:00:00+05:30')}</div>
                  </div>
                  <div><div style={{ fontWeight: 600, fontSize: 15 }}>{x.title}</div>{x.sub && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{x.sub}</div>}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Looking for a team</h4>
            <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', marginBottom: 14 }}>Students who&apos;ve put themselves out there</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {d.looking.map((p) => (
                <Link key={p.id} href={`/u/${p.handle}`} className="title-link" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar person={p} size={34} />
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>@{p.handle} {flair(p.branch_code, p.grad_year) && <span style={{ fontWeight: 400, color: 'var(--color-neutral-700)' }}>· {flair(p.branch_code, p.grad_year)}</span>}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{p.skills.join(', ')}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
