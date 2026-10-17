import Link from 'next/link';
import { notFound } from 'next/navigation';
import { compact, daysUntil, fileSize, getSubject, n } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Tag } from '@/components/ui';
import { SubjectFiles, UploadButton } from '@/components/library/LibraryClient';
import { threadHref } from '@/lib/routes';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: code.toUpperCase() };
}

// Web layout of the mobile "Subject files" screen.
export default async function SubjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { sb } = await currentUser();
  const d = await getSubject(sb, code.toUpperCase());
  if (!d) notFound();
  const s = d.subject;
  const days = s.exam_on ? daysUntil(s.exam_on) : null;
  return (
    <div className="px" style={{ paddingTop: 28, maxWidth: 860 }}>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
        <Link href="/library">Library</Link> / <Link href={`/library/${s.branch_code}/${s.semester}`}>{s.branch_code} › Sem {s.semester}</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{s.code}</div>
          <h1 className="display" style={{ fontSize: 44, margin: '4px 0 0', letterSpacing: '-.025em' }}>{s.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 14, color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
            {days != null && days >= 0 && <Tag tone="accent2">End-sem in {days} days</Tag>}
            {[s.professor, s.credits && `${s.credits} credits`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}><UploadButton subjects={[{ code: s.code, name: s.name }]} defaultSubject={s.code} /></div>
      </div>
      <SubjectFiles
        counts={{ pyq: s.pyq_count, notes: s.notes_count, lab: s.lab_count }}
        items={d.items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, format: i.format, size: fileSize(i.size_bytes), uploader: i.uploader?.handle ?? null, downloads: compact(i.downloads), top_rated: i.top_rated }))}
        threads={d.threads.map((t) => ({ href: threadHref(t), title: t.title, meta: `${n(t.score)} votes · ${n(t.reply_count)} replies` }))}
      />
    </div>
  );
}
