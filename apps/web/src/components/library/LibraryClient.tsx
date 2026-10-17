'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { searchSubjects, uploadLibraryItem, type SubjectRow } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { useShell } from '../shell/Shell';

export function SubjectSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SubjectRow[]>([]);
  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const t = setTimeout(async () => setRes(await searchSubjects(supabaseBrowser(), q.trim())), 120);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'min(340px, 70vw)', height: 44, padding: '0 14px', background: 'var(--color-surface)', borderRadius: 2, color: 'var(--color-neutral-700)', fontSize: 15 }}>
        <Icon name="magnifying-glass" size={19} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subjects, codes like CO201" aria-label="Search subjects"
          style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', font: '400 15px var(--font-body)', color: 'var(--color-text)' }} />
      </label>
      {res.length > 0 && (
        <div style={{ position: 'absolute', top: 48, left: 0, right: 0, background: 'var(--color-bg)', boxShadow: 'var(--shadow-md)', borderRadius: 2, zIndex: 5, padding: '6px 0' }}>
          {res.map((s) => (
            <Link key={s.code} href={`/library/subject/${s.code}`} className="hover-row" style={{ display: 'flex', gap: 12, padding: '8px 14px', color: 'var(--color-text)', fontSize: 15 }}>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', width: 52 }}>{s.code}</span>{s.name}
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{s.branch_code} · Sem {s.semester}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const KINDS = [['notes', 'Notes'], ['pyq', 'PYQ'], ['lab', 'Lab file'], ['slides', 'Slides']] as const;

export function UploadButton({ subjects, defaultSubject, floating }: { subjects: { code: string; name: string }[]; defaultSubject?: string; floating?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn btn-primary${floating ? ' elev-md' : ''}`} style={floating ? { height: 48, padding: '0 18px' } : { height: 44 }} onClick={() => setOpen(true)}>
        <Icon name="upload-simple" size={17} />Upload
      </button>
      {open && <UploadDialog subjects={subjects} defaultSubject={defaultSubject} onClose={() => setOpen(false)} />}
    </>
  );
}

function UploadDialog({ subjects, defaultSubject, onClose }: { subjects: { code: string; name: string }[]; defaultSubject?: string; onClose: () => void }) {
  const { me, toast } = useShell();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('notes');
  const [subject, setSubject] = useState(defaultSubject ?? subjects[0]?.code ?? '');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file || !subject || !title.trim()) { toast('Pick a file, subject and title.'); return; }
    setBusy(true);
    try {
      await uploadLibraryItem(supabaseBrowser(), { userId: me.id, subjectCode: subject, kind, title: title.trim(), file, fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size });
      toast('Uploaded — thanks for sharing.');
      onClose(); router.refresh();
    } catch (e) { toast((e as Error).message); setBusy(false); }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ zIndex: 40 }}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)', background: 'var(--color-bg)' }} role="dialog" aria-label="Upload to the Library">
        <div className="dialog-title">Upload to the Library</div>
        <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', border: '1px dashed var(--color-neutral-400)', borderRadius: 2, background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-neutral-700)', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
          <Icon name="upload-simple" size={20} color="var(--color-accent)" />{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : 'Choose a PDF, PPT, ZIP or image (max 50 MB)'}
        </button>
        <input ref={fileRef} type="file" hidden accept=".pdf,.ppt,.pptx,.zip,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')); }} />
        <div>
          <div className="label-caps">Type</div>
          <div className="seg">{KINDS.map(([k, l]) => <label key={k} className="seg-opt"><input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{l}</label>)}</div>
        </div>
        <div>
          <div className="label-caps">Subject</div>
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ height: 40 }}>
            {subjects.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
          </select>
        </div>
        <div>
          <div className="label-caps">Title</div>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 4 notes, handwritten" style={{ height: 40 }} />
        </div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Uploading…' : 'Upload'}</button>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ['All', 'PYQs', 'Notes', 'Lab files', 'Threads'] as const;

export interface FileItem { id: number; kind: string; title: string; format: string; size: string; uploader: string | null; downloads: string; top_rated: boolean }
export interface SubjectThread { href: string; title: string; meta: string }

const ICON: Record<string, [string, string]> = {
  pyq: ['file-pdf', 'var(--color-accent-2)'], notes: ['file-text', 'var(--color-accent)'],
  slides: ['presentation', 'var(--color-accent)'], lab: ['file-code', 'var(--color-neutral-700)'],
};

/** Subject files with working All / PYQs / Notes / Lab files / Threads filters. */
export function SubjectFiles({ items, threads, counts }: { items: FileItem[]; threads: SubjectThread[]; counts: { pyq: number; notes: number; lab: number } }) {
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const show = { pyq: f === 'All' || f === 'PYQs', notes: f === 'All' || f === 'Notes', lab: f === 'All' || f === 'Lab files', threads: f === 'All' || f === 'Threads' };
  const section = (title: string, count: string, list: FileItem[]) => (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 8 }}>
        <span style={{ font: '600 20px var(--font-heading)' }}>{title}</span><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{count}</span>
      </div>
      {list.map((it) => <FileRow key={it.id} it={it} />)}
      {!list.length && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>Nothing uploaded yet.</div>}
    </section>
  );
  return (
    <>
      <div className="pills" style={{ marginTop: 20 }}>
        {FILTERS.map((x) => <button key={x} className="pill t-neutral" data-active={f === x} onClick={() => setF(x)} style={f !== x ? { background: 'var(--color-surface)' } : undefined}>{x}</button>)}
      </div>
      {show.pyq && section('PYQs', `${counts.pyq} papers`, items.filter((i) => i.kind === 'pyq'))}
      {show.notes && section('Notes', `${counts.notes} files`, items.filter((i) => i.kind === 'notes' || i.kind === 'slides'))}
      {show.lab && section('Lab files', `${counts.lab} files`, items.filter((i) => i.kind === 'lab'))}
      {show.threads && (
        <section style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 8 }}>
            <span style={{ font: '600 20px var(--font-heading)' }}>Discussions</span><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{threads.length} active</span>
          </div>
          {threads.map((t) => (
            <Link key={t.href} href={t.href} className="row-rule title-link" style={{ display: 'block', padding: '14px 0' }}>
              <div style={{ font: '600 17px/1.3 var(--font-heading)' }}>{t.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>{t.meta}</div>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

function FileRow({ it }: { it: FileItem }) {
  const { toast } = useShell();
  const [ic, col] = ICON[it.kind] ?? ICON.notes;
  const download = async () => {
    try {
      const { downloadItem } = await import('@dtour/shared');
      const url = await downloadItem(supabaseBrowser(), it.id);
      if (url) window.open(url, '_blank'); else toast('This is a demo file — real uploads download here.');
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="row-rule" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
      <span style={{ width: 42, height: 48, flex: 'none', borderRadius: 2, background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={24} color={col} /></span>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ font: '600 17px/1.3 var(--font-heading)' }}>{it.title}</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 2 }}>{[it.format, it.size, it.uploader && `@${it.uploader}`].filter(Boolean).join(' · ')}</div>
        {it.top_rated && <span className="tag tag-accent" style={{ marginTop: 6, fontSize: 10.5 }}>Top rated</span>}
      </div>
      <button onClick={download} aria-label={`Download ${it.title}`} style={{ width: 52, height: 44, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--color-neutral-700)', background: 'none', border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
        <Icon name="download-simple" size={20} color="var(--color-accent)" />{it.downloads}
      </button>
    </div>
  );
}
