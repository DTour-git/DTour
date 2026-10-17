import { dayNum, getPlaces, weekdayCaps } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Halftone, SectionRule, Tag } from '@/components/ui';
import { Heart } from '@/components/Toggles';
import { RecommendPlace } from '@/components/RecommendPlace';

export const metadata = { title: 'Kahan chalein?' };
const FILTERS: [string, string, string][] = [['all', 'Everything', 't-neutral'], ['campus', 'On campus', 't-accent2'], ['nearby', 'Khaana nearby', 't-accent'], ['delhi', 'Events in Delhi', 't-accent'], ['chill', 'Chill spots', 't-neutral'], ['cheap', 'Under ₹100', 't-neutral']];

export default async function KahanPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = 'all' } = await searchParams;
  const { sb, me } = await currentUser();
  const d = await getPlaces(sb, me?.userId ?? null);
  const cheap = f === 'cheap';
  const keep = <T extends { under_100: boolean; on_campus: boolean }>(xs: T[]) => xs.filter((x) => (!cheap || x.under_100) && (f !== 'campus' || x.on_campus));
  const show = (s: string) => f === 'all' || f === 'cheap' || f === s || (f === 'campus' && (s === 'canteen' || s === 'chill'));
  const canteen = keep(d.canteen).slice(0, 4), nearby = keep(d.nearby), delhi = keep(d.delhi), chill = keep(d.chill);

  return (
    <>
      <div className="flex-wrap-row px" style={{ paddingTop: 36 }}>
        <div>
          <h1 className="display" style={{ fontSize: 54, margin: 0, letterSpacing: '-.03em' }}>Kahan chalein?</h1>
          <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>Canteen favourites, food near campus, and what&apos;s on in Delhi this week — recommended by students.</div>
        </div>
        <div style={{ marginLeft: 'auto' }}><RecommendPlace /></div>
      </div>
      <div className="pills px" style={{ paddingTop: 24 }}>
        {FILTERS.map(([k, l, cls]) => <a key={k} href={k === 'all' ? '/kahan-chalein' : `/kahan-chalein?f=${k}`} className={`pill ${cls}`} data-active={f === k}>{l}</a>)}
      </div>

      {show('canteen') && canteen.length > 0 && (
        <section className="px" style={{ paddingTop: 48 }}>
          <SectionRule num="01" title="Canteen favourites" tone="accent2" sub="What DTU actually orders, ranked by hearts" />
          <div className="grid-4" style={{ gap: 40, marginTop: 22 }}>
            {canteen.map((p) => (
              <div key={p.id}>
                <div style={{ font: '600 19px/1.25 var(--font-heading)' }}>{p.name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', marginTop: 4 }}>{p.where_label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600 }}>{p.price_label}</span><Heart placeId={p.id} hearted={d.myHearts.has(p.id)} count={p.hearts} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {show('nearby') && nearby.length > 0 && (
        <section className="px" style={{ paddingTop: 52 }}>
          <SectionRule num="02" title="Khaana nearby" tone="accent" sub="Within 10 km of the main gate"
            right={<a href="https://www.google.com/maps/search/food+near+Delhi+Technological+University" target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600 }}>Open map →</a>} />
          <div className="grid-4" style={{ gap: 28, marginTop: 24 }}>
            {nearby.map((p) => (
              <div key={p.id}>
                <Halftone height={150} label={p.image_label} src={p.image_path} style={{ padding: 8 }} />
                <div style={{ font: '600 19px/1.25 var(--font-heading)', marginTop: 12 }}>{p.name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', marginTop: 3 }}>{[p.where_label, p.distance_km && `${p.distance_km} km`, p.price_label].filter(Boolean).join(' · ')}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {p.recs > 0 ? <Tag>{p.recs} recs</Tag> : p.tags[0] && <Tag>{p.tags[0]}</Tag>}
                  {(p.recs > 0 ? p.tags : p.tags.slice(1)).map((t) => <Tag key={t} tone="accent">{t}</Tag>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid-3-2 px" style={{ paddingTop: 52 }}>
        {show('delhi') && delhi.length > 0 && (
          <section>
            <SectionRule num="03" title="This week in Delhi" tone="accent" />
            {delhi.map((p, i) => (
              <div key={p.id} className="row-rule" style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr) auto', gap: 16, alignItems: 'center', padding: '16px 0' }}>
                <div style={{ lineHeight: 1 }}>
                  <div style={{ font: '600 28px var(--font-heading)', color: i === 0 ? 'var(--color-accent-2-700)' : 'var(--color-text)' }}>{p.event_on && dayNum(p.event_on + 'T12:00:00+05:30')}</div>
                  <div style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--color-neutral-700)' }}>{p.event_on && weekdayCaps(p.event_on + 'T12:00:00+05:30')}</div>
                </div>
                <div><div style={{ font: '600 18px/1.3 var(--font-heading)' }}>{p.name}</div><div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', marginTop: 3 }}>{p.where_label}</div></div>
                {p.metro_minutes && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="train-simple" size={17} color="var(--color-accent)" />~{p.metro_minutes} min</div>}
              </div>
            ))}
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 12 }}>Travel times from Samaypur Badli metro (Yellow Line).</div>
          </section>
        )}
        {show('chill') && chill.length > 0 && (
          <section>
            <SectionRule num="04" title="Chill spots" tone="ink" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
              {chill.map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Icon name={p.icon ?? 'map-pin'} size={26} color="var(--color-accent)" />
                  <div><div style={{ font: '600 18px var(--font-heading)' }}>{p.name}</div><div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{p.where_label}</div></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
