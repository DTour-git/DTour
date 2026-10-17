import Link from 'next/link';
import { getSocietyBoard, n, POST_KIND_LABEL, postKindTone } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Halftone } from '@/components/ui';
import { Rsvp } from '@/components/Toggles';

export const metadata = { title: 'Society board' };
const FILTERS: [string | null, string, string][] = [[null, 'All', 't-neutral'], ['event', 'Events', 't-accent2'], ['recruiting', 'Recruitments', 't-accent2'], ['workshop', 'Workshops', 't-accent'], ['talk', 'Talks & lectures', 't-accent']];

export default async function SocietiesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const { sb, me } = await currentUser();
  const d = await getSocietyBoard(sb, me?.userId ?? null, kind ?? null);
  return (
    <>
      <div className="flex-wrap-row px" style={{ paddingTop: 36 }}>
        <div>
          <h1 className="display" style={{ fontSize: 48, margin: 0, letterSpacing: '-.025em' }}>Society board</h1>
          <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>Events, recruitments, workshops and talks from {d.verifiedCount} verified societies.</div>
        </div>
        <Link href="/new?type=event" className="btn btn-primary" style={{ marginLeft: 'auto', color: 'var(--color-bg)' }}><Icon name="megaphone" size={17} />Promote an event</Link>
      </div>
      <div className="pills px" style={{ paddingTop: 24 }}>
        {FILTERS.map(([k, l, cls]) => <Link key={l} href={k ? `/societies?kind=${k}` : '/societies'} className={`pill ${cls}`} data-active={(kind ?? null) === k}>{l}</Link>)}
      </div>
      <div className="masonry px" style={{ paddingTop: 34 }}>
        {d.posts.map((p) => {
          const kick = `${POST_KIND_LABEL[p.kind]} · ${p.when_label}${p.where_label && p.kind !== 'event' ? ` · ${p.where_label}` : ''}`;
          const going = d.myRsvps.has(p.id);
          if (p.featured) return (
            <div key={p.id} style={{ marginBottom: 30, padding: 20, background: 'var(--color-accent-2-100)', borderRadius: 2 }}>
              <div className="kicker" style={{ color: 'var(--color-accent-2-800)' }}>{kick}</div>
              <div style={{ font: '600 28px/1.1 var(--font-heading)', margin: '8px 0', color: 'var(--color-accent-2-900)' }}>{p.title}</div>
              {p.body && <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-accent-2-900)' }}>{p.body}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13, color: 'var(--color-accent-2-800)' }}>
                {p.society.name} {p.society.verified && <Icon name="seal-check" size={15} />} · <Rsvp postId={p.id} going={going} count={p.rsvp_count} word={p.rsvp_word} featured />
              </div>
            </div>
          );
          return (
            <div key={p.id} style={{ marginBottom: 30 }}>
              {p.poster_label && <Halftone height={150} label={p.poster_label} style={{ marginBottom: 12, padding: 8 }} />}
              <div className="kicker" style={{ color: postKindTone(p.kind) === 'accent2' ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)' }}>{kick}</div>
              <div style={{ font: '600 24px/1.15 var(--font-heading)', margin: '6px 0' }}>{p.title}</div>
              {p.body && <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-neutral-800)' }}>{p.body}</div>}
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                {p.society.short_name ?? p.society.name} {p.society.verified && <Icon name="seal-check" size={15} color="var(--color-accent)" />} ·{' '}
                {p.kind === 'recruiting'
                  ? <a href={p.apply_url ?? '#'} target="_blank" rel="noreferrer">Apply</a>
                  : <span style={{ display: 'contents' }}><Rsvp postId={p.id} going={going} count={p.rsvp_count} word={p.rsvp_word} label="RSVP" /></span>}
              </div>
            </div>
          );
        })}
      </div>
      {!d.posts.length && <div className="px" style={{ color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>Nothing here yet.</div>}
    </>
  );
}
