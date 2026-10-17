import Link from 'next/link';
import { getWikiIndex, n, type Tone } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { Halftone, SectionRule, pad2 } from '@/components/ui';

export const metadata = { title: 'The Wiki' };

// Web layout of the mobile "Wiki index" screen (the web prototype links Articles straight to an article).
export default async function WikiIndex({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const { sb } = await currentUser();
  const d = await getWikiIndex(sb);
  const cats = d.categories.filter((c) => !topic || c.slug === topic);

  return (
    <div className="px" style={{ paddingTop: 36 }}>
      <div className="flex-wrap-row">
        <div>
          <h1 className="display" style={{ fontSize: 54, margin: 0, letterSpacing: '-.03em' }}>The Wiki</h1>
          <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>
            Guides written and kept current by DTU students. {n(d.articleCount)} articles · {n(d.editorCount)} editors.
          </div>
        </div>
        <Link href="/new?type=article" className="btn btn-primary" style={{ marginLeft: 'auto', color: 'var(--color-bg)' }}><Icon name="pencil-simple-line" size={17} />Start a guide</Link>
      </div>
      <div className="pills" style={{ paddingTop: 24 }}>
        <Link href="/wiki" className="pill t-neutral" data-active={!topic}>All</Link>
        {d.categories.map((c) => <Link key={c.id} href={`/wiki?topic=${c.slug}`} className="pill t-neutral" data-active={topic === c.slug}>{c.pill}</Link>)}
      </div>

      <div className="grid-side" style={{ marginTop: 34 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {cats.map((c) => {
            const list = d.articles.filter((a) => a.category_id === c.id);
            return (
              <section key={c.id}>
                <SectionRule num={pad2(c.id)} title={c.name} tone={c.tone as Tone} />
                {list.map((a) => (
                  <Link key={a.id} href={`/wiki/${a.slug}`} className="row-rule title-link" style={{ display: 'block', padding: '16px 0' }}>
                    <div style={{ font: '600 19px/1.3 var(--font-heading)' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>
                      {a.checked_at && <Icon name="shield-check" size={15} color="var(--color-accent)" />}{a.editor_count} editors · {a.read_minutes} min
                    </div>
                  </Link>
                ))}
                {!list.length && <div style={{ padding: '16px 0', color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No guides here yet.</div>}
              </section>
            );
          })}
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {d.mostRead && (
            <Link href={`/wiki/${d.mostRead.slug}`} className="title-link">
              <Halftone height={150} label={d.mostRead.cover_label} src={d.mostRead.cover_path} />
              <div className="kicker" style={{ color: 'var(--color-accent-2-700)', marginTop: 12 }}>Most read this week</div>
              <div style={{ font: '600 23px/1.15 var(--font-heading)', marginTop: 6 }}>{d.mostRead.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 6 }}>
                {d.mostRead.checked_at && <><Icon name="shield-check" size={15} color="var(--color-accent)" />Checked {new Date(d.mostRead.checked_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} · </>}
                {d.mostRead.editor_count} editors · {d.mostRead.read_minutes} min
              </div>
            </Link>
          )}
          <div style={{ padding: 16, background: 'var(--color-accent-100)', borderRadius: 2, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Icon name="pencil-simple-line" size={22} color="var(--color-accent-700)" />
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, color: 'var(--color-accent-900)' }}>
              <b>Missing a guide?</b> <Link href="/new?type=article">Start one</Link> — seniors can review and mark it checked.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
