import Link from 'next/link';
import { compact, daysUntil, getLibrary, n } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Icon } from '@/components/Icon';
import { H6, Tag } from '@/components/ui';
import { SubjectSearch, UploadButton } from '@/components/library/LibraryClient';

export const metadata = { title: 'Library' };
const SEMS: [string, number][] = [['Sem 1–2', 1], ['Sem 3', 3], ['Sem 4', 4], ['Sem 5', 5], ['Sem 6', 6], ['Sem 7', 7], ['Sem 8', 8]];

export default async function LibraryPage({ params }: { params: Promise<{ branch: string; sem: string }> }) {
  const { branch: rawBranch, sem: rawSem } = await params;
  const branch = rawBranch.toUpperCase();
  const sem = Math.min(8, Math.max(1, Number(rawSem) || 1));
  const { sb } = await currentUser();
  const d = await getLibrary(sb, branch, sem === 2 ? 2 : sem);
  const b = d.branches.find((x) => x.code === branch);
  const sel = sem <= 2 ? 1 : sem;

  return (
    <>
      <div className="flex-wrap-row px" style={{ paddingTop: 36 }}>
        <div>
          <h1 className="display" style={{ fontSize: 48, margin: 0, letterSpacing: '-.025em' }}>Library</h1>
          <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>Notes, PYQs and lab files from every batch, organised the way DTU is.</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SubjectSearch />
          <UploadButton subjects={d.subjects.map((s) => ({ code: s.code, name: s.name }))} />
        </div>
      </div>

      <div className="lib-browser mx" style={{ marginTop: 34 }}>
        <div style={{ paddingRight: 24 }}>
          <H6 style={{ margin: '0 0 12px 10px' }}>Branch</H6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15.5 }}>
            {d.branches.filter((x) => x.code !== 'FY' && (x.file_count > 0 || x.code === branch)).map((x) => (
              <Link key={x.code} href={`/library/${x.code}/${sem}`} className="select-row" aria-current={x.code === branch}>
                {x.name}{x.code === branch ? <Icon name="caret-right" size={16} /> : <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{compact(x.file_count)}</span>}
              </Link>
            ))}
            <Link href="/library/FY/1" className="select-row" aria-current={branch === 'FY'} style={branch === 'FY' ? undefined : { color: 'var(--color-neutral-700)' }}>First year (common)</Link>
          </div>
        </div>
        <div style={{ padding: '0 24px', borderLeft: '1px solid var(--color-divider)' }}>
          <H6 style={{ margin: '0 0 12px 10px' }}>Semester</H6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 15.5 }}>
            {SEMS.map(([label, s]) => (
              <Link key={s} href={`/library/${branch}/${s}`} className="select-row" aria-current={s === sel}>
                {label}{s === sel && <Icon name="caret-right" size={16} />}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ paddingLeft: 32, borderLeft: '1px solid var(--color-divider)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <H6 style={{ margin: 0 }}>Subjects · {branch} · Sem {sel <= 2 ? '1–2' : sel}</H6>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-neutral-700)' }}>Sorted by</span>
            <span style={{ font: '600 13px var(--font-heading)', color: 'var(--color-accent-700)' }}>Most used</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            {d.subjects.map((s, i) => {
              const days = s.exam_on ? daysUntil(s.exam_on) : null;
              return (
                <Link key={s.code} href={`/library/subject/${s.code}`} className={`title-link${i < d.subjects.length - 1 ? ' row-rule' : ''}`}
                  style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) auto', gap: 16, alignItems: 'center', padding: '16px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{s.code}</span>
                  <div>
                    <div style={{ font: '600 19px var(--font-heading)' }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 3, flexWrap: 'wrap' }}>
                      <span>{s.notes_count} notes</span>{s.pyq_count > 0 && <span>{s.pyq_count} PYQs</span>}{s.lab_count > 0 && <span>{s.lab_count} lab files</span>}
                      {s.thread_count > 0 && <span>· {s.thread_count} active threads</span>}
                    </div>
                  </div>
                  {i === 0 && days != null && days >= 0 && days <= 30 ? <Tag tone="accent2">End-sem in {days}d</Tag> : <Icon name="caret-right" size={16} color="var(--color-neutral-600)" />}
                </Link>
              );
            })}
            {!d.subjects.length && <div style={{ padding: '20px 0', color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>No subjects listed for this semester yet.</div>}
          </div>
          {d.top.length > 0 && <>
            <H6 style={{ margin: '36px 0 12px' }}>Most downloaded this week · Sem {sel <= 2 ? '1–2' : sel}</H6>
            <div className="grid-3" style={{ gap: 16 }}>
              {d.top.map((it) => (
                <Link key={it.id} href={`/library/subject/${it.subject_code}`} className="card title-link">
                  <div className="card-kicker">{({ pyq: 'PYQ', notes: 'Notes', lab: 'Lab', slides: 'Slides' } as Record<string, string>)[it.kind]} · {it.subject_code}</div>
                  <div className="card-title">{it.title}</div>
                  <div className="card-meta"><Icon name="download-simple" size={13} />{n(it.downloads)}{it.uploader && ` · @${it.uploader.handle}`}</div>
                </Link>
              ))}
            </div>
          </>}
        </div>
      </div>
    </>
  );
}
