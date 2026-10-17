'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createSocietyPost, createTeam, createThread, createWikiArticle, flair, saveDraft, similarThreads, uploadImage, uploadLibraryItem,
  type Database, type PostType, type ProfileRow, type SocietyLite, type Tone,
} from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '@/components/Icon';
import { Avatar, Tag } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { useShell } from '@/components/shell/Shell';

type Board = { id: string; slug: string; verified_only: boolean; rules: string[]; tone: Tone; path: string[] };
const TYPES: [PostType, string, string, string][] = [
  ['thread', 'Thread', 'chat-circle', 'Start a discussion'], ['question', 'Question', 'question', 'Get an accepted answer'],
  ['article', 'Wiki article', 'article', 'Shared, editable guide'], ['team', 'Team', 'users-three', 'Find teammates'],
  ['poll', 'Poll', 'chart-bar-horizontal', 'Let campus vote'], ['event', 'Society post', 'megaphone', 'Events, recruiting, talks'],
];
const TONE_SQ: Record<Tone, string> = { accent: 'var(--color-accent)', accent2: 'var(--color-accent-2)', ink: 'var(--color-text)' };
const FORMATS: [string, string, string, string][] = [
  ['text-b', '**', '**', 'bold'], ['text-italic', '*', '*', 'italic'], ['link', '[', '](https://)', 'link'],
  ['quotes', '\n> ', '', 'quote'], ['code', '`', '`', 'code'], ['list-bullets', '\n- ', '', 'item'], ['function', '$', '$', 'x^2'],
];
const Label = ({ children }: { children: React.ReactNode }) => <div className="label-caps">{children}</div>;

type Draft = Database['public']['Tables']['drafts']['Row'];

export function Composer({ me, boards, societies, subjects, initialType, initialBoard, initialTitle, initialDraft }: {
  me: ProfileRow; boards: Board[]; societies: SocietyLite[]; subjects: { code: string; name: string }[];
  initialType?: string; initialBoard?: string; initialTitle?: string; initialDraft?: Draft | null;
}) {
  const { toast } = useShell();
  const router = useRouter();
  const body = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const postable = boards.filter((b) => !b.verified_only || societies.length > 0);
  const defBoard = postable.find((b) => b.slug === initialBoard) ?? postable.find((b) => b.slug === `academics-${(me.branch_code ?? '').toLowerCase()}`) ?? postable.find((b) => b.slug === 'campus-buzz') ?? postable[0];
  const saved = initialDraft?.payload && typeof initialDraft.payload === 'object' && !Array.isArray(initialDraft.payload) ? initialDraft.payload as Record<string, unknown> : {};

  const [type, setType] = useState<PostType>((TYPES.find(([k]) => k === (initialDraft?.kind ?? initialType))?.[0]) ?? 'thread');
  const [boardId, setBoardId] = useState(initialDraft?.board_id ?? defBoard?.id ?? '');
  const [picking, setPicking] = useState(false);
  const [pickQ, setPickQ] = useState('');
  const [selectedSociety, setAsSociety] = useState<SocietyLite | null>(societies.find((s) => s.id === saved.societyId) ?? null);
  const [title, setTitle] = useState(initialDraft?.title ?? initialTitle ?? '');
  const [text, setText] = useState(initialDraft?.body ?? '');
  const [tags, setTags] = useState<string[]>(Array.isArray(saved.tags) ? saved.tags as string[] : []);
  const [tagDraft, setTagDraft] = useState('');
  const [preview, setPreview] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [fileSubject, setFileSubject] = useState('');
  const [fileKind, setFileKind] = useState<'notes' | 'pyq' | 'lab' | 'slides'>('notes');
  const [pollOpts, setPollOpts] = useState<string[]>(Array.isArray(saved.pollOpts) ? saved.pollOpts as string[] : ['', '']);
  const [pollDays, setPollDays] = useState(typeof saved.pollDays === 'number' ? saved.pollDays : 3);
  const [notifyReplies, setNotifyReplies] = useState(saved.notifyReplies !== false);
  const [team, setTeam] = useState({ event: '', closes: '', category: 'hackathon', roles: [] as { name: string; filled: boolean }[], roleDraft: '', ...(saved.team && typeof saved.team === 'object' ? saved.team as object : {}) });
  const [ev, setEv] = useState({ kind: 'event', when: '', where: '', starts: '', applyUrl: '', ...(saved.ev && typeof saved.ev === 'object' ? saved.ev as object : {}) });
  const [similar, setSimilar] = useState<{ title: string; sub: string; route: string }[]>([]);
  const [draftId, setDraftId] = useState<string | undefined>(initialDraft?.id);
  const [busy, setBusy] = useState(false);
  const asSociety = selectedSociety ?? (type === 'event' ? societies[0] ?? null : null);
  const board = boards.find((b) => b.id === boardId);

  useEffect(() => {
    const t = setTimeout(async () => setSimilar(title.trim().length > 3 ? await similarThreads(supabaseBrowser(), title) : []), 250);
    return () => clearTimeout(t);
  }, [title]);

  const suggested = useMemo(() => {
    const w = title.toLowerCase();
    const pick = (slug: string) => boards.find((b) => b.slug === slug);
    const out = [/exam|result|datesheet|reval/.test(w) && pick('exams-results'), /intern|placement|interview|offer/.test(w) && pick('placements'), pick('campus-buzz'), pick('exams-results')].filter(Boolean) as Board[];
    return [...new Map(out.filter((b) => b.id !== boardId).map((b) => [b.id, b])).values()].slice(0, 2);
  }, [title, boards, boardId]);

  const wrap = (before: string, after = before, placeholder = '') => {
    const el = body.current; if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = text.slice(s, e) || placeholder;
    const next = text.slice(0, s) + before + sel + after + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '');
    if (t && !tags.includes(t) && tags.length < 6) setTags([...tags, t]);
    setTagDraft('');
  };

  const tl = title.length;
  const hint = tl === 0 ? 'Good titles get 3× more replies' : tl < 20 ? 'A bit more detail helps' : 'Looks clear';

  const submit = async () => {
    if (title.trim().length < 3) { toast('Add a title first.'); return; }
    const sb = supabaseBrowser();
    setBusy(true);
    try {
      const discardDraft = async () => { if (draftId) await sb.from('drafts').delete().eq('id', draftId).eq('user_id', me.id); };
      if (type === 'article') {
        const coverPath = cover ? await uploadImage(sb, me.id, cover, cover.name, cover.type) : null;
        const slug = await createWikiArticle(sb, { userId: me.id, title, body: text, boardId: boardId || null, coverPath });
        await discardDraft();
        toast(me.role === 'member' ? 'Sent to the moderators — your guide goes live once approved.' : 'Published.');
        router.push(`/wiki/${slug}`); return;
      }
      if (type === 'team') {
        if (!team.event.trim()) throw new Error('Name the event or hackathon.');
        await createTeam(sb, { userId: me.id, category: team.category, eventName: team.event, title, description: text, deadlineOn: team.closes || null, roles: team.roles });
        await discardDraft();
        router.push('/teams'); return;
      }
      if (type === 'event') {
        if (!asSociety) throw new Error('Only verified society accounts can post to the Society board.');
        if (ev.starts && Number.isNaN(Date.parse(ev.starts))) throw new Error('Enter a valid start date and time.');
        const posterPath = poster ? await uploadImage(sb, me.id, poster, poster.name, poster.type) : null;
        await createSocietyPost(sb, { userId: me.id, societyId: asSociety.id, kind: ev.kind, title, body: text, whenLabel: ev.when || 'soon', whereLabel: ev.where, startsAt: ev.starts ? new Date(ev.starts).toISOString() : null, applyUrl: ev.applyUrl, posterPath });
        await discardDraft();
        router.push('/societies'); return;
      }
      if (!boardId) throw new Error('Pick a board.');
      if (type === 'poll' && pollOpts.filter((option) => option.trim()).length < 2) throw new Error('Add at least two poll options.');
      if (file && !fileSubject) throw new Error('Pick a Library subject for the attachment.');
      const kind = type === 'poll' ? 'poll' : type === 'question' ? 'question' : 'thread';
      const id = await createThread(sb, { userId: me.id, boardId, kind, title, body: text, tags: [...tags, tagDraft.trim().replace(/^#/, '')].filter(Boolean), pollOptions: pollOpts.map((o) => o.trim()).filter(Boolean), pollDays, societyId: asSociety?.id ?? null, notifyOnReply: notifyReplies });
      if (file && fileSubject) {
        try {
          const itemId = await uploadLibraryItem(sb, { userId: me.id, subjectCode: fileSubject, kind: fileKind, title: file.name.replace(/\.[^.]+$/, ''), file, fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size });
          const { error } = await sb.from('threads').update({ attachment: { name: file.name, size: `${(file.size / 1048576).toFixed(1)} MB`, subject: fileSubject, library_item_id: itemId } }).eq('id', id);
          if (error) throw error;
        } catch (error) { toast(`Post published, but the attachment failed: ${(error as Error).message}`); }
      }
      await discardDraft();
      router.push(`/t/${id}`);
    } catch (e) { toast((e as Error).message); setBusy(false); }
  };

  const save = async () => {
    try {
      setDraftId(await saveDraft(supabaseBrowser(), { id: draftId, userId: me.id, kind: type, boardId: boardId || null, title, body: text, payload: { tags, pollOpts, pollDays, notifyReplies, team, ev, societyId: asSociety?.id ?? null } }));
      toast('Draft saved.');
    } catch (e) { toast((e as Error).message); }
  };

  const filtered = boards.filter((b) => b.path.join(' ').toLowerCase().includes(pickQ.toLowerCase()) && (!b.verified_only || societies.length));

  return (
    <div className="grid-side px" style={{ paddingTop: 32 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}><Link href="/">Today</Link> / New post</div>
        <h1 className="display" style={{ fontSize: 44, margin: '14px 0 28px', letterSpacing: '-.025em' }}>What do you want to share?</h1>
        <Label>Type</Label>
        <div className="post-types">
          {TYPES.map(([k, label, icon, h]) => (
            <button key={k} onClick={() => setType(k)} aria-pressed={type === k}
              style={{ cursor: 'pointer', padding: '14px 14px 12px', borderRadius: 2, border: 0, textAlign: 'left', fontFamily: 'var(--font-body)',
                background: type === k ? 'var(--color-accent-100)' : 'var(--color-surface)', color: type === k ? 'var(--color-accent-900)' : 'var(--color-text)',
                boxShadow: type === k ? 'inset 0 0 0 2px var(--color-accent)' : 'none' }}>
              <Icon name={icon} size={24} />
              <div style={{ font: '600 15px var(--font-heading)', marginTop: 8 }}>{label}</div>
              <div style={{ fontSize: 12, lineHeight: 1.35, opacity: 0.8, marginTop: 2 }}>{h}</div>
            </button>
          ))}
        </div>

        <div className="grid-2" style={{ gap: 20, marginTop: 34 }}>
          <div style={{ position: 'relative' }}>
            <Label>{type === 'event' ? 'Society board' : type === 'team' ? 'Team Up' : 'Post in'}</Label>
            {type === 'team' || type === 'event' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', background: 'var(--color-surface)', borderRadius: 2, fontSize: 15, color: 'var(--color-neutral-700)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: type === 'event' ? 'var(--color-accent-2)' : 'var(--color-accent)' }} />
                {type === 'event' ? <>Culture › <b style={{ font: '600 15px var(--font-heading)', color: 'var(--color-text)' }}>Societies</b></> : <>Career › <b style={{ font: '600 15px var(--font-heading)', color: 'var(--color-text)' }}>Team Up</b></>}
              </div>
            ) : (
              <button onClick={() => setPicking(!picking)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', background: 'var(--color-surface)', borderRadius: 2, border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                {board && <span style={{ width: 10, height: 10, flex: 'none', borderRadius: 2, background: TONE_SQ[board.tone] }} />}
                <span className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--color-neutral-700)' }}>
                  {board ? <>{board.path.slice(0, -1).join(' › ')} › <span style={{ font: '600 15px var(--font-heading)', color: 'var(--color-text)' }}>{board.path[board.path.length - 1]}</span></> : 'Pick a board'}
                </span>
                <Icon name="caret-down" size={16} color="var(--color-neutral-700)" />
              </button>
            )}
            {picking && (
              <div style={{ position: 'absolute', top: 76, left: 0, right: 0, background: 'var(--color-bg)', boxShadow: 'var(--shadow-md)', borderRadius: 2, zIndex: 5, maxHeight: 340, overflow: 'auto' }}>
                <input autoFocus className="input" placeholder="Find a board…" value={pickQ} onChange={(e) => setPickQ(e.target.value)} style={{ border: 0, borderBottom: '1px solid var(--color-divider)', borderRadius: 0, height: 40, background: 'var(--color-bg)' }} />
                {filtered.map((b) => (
                  <button key={b.id} onClick={() => { setBoardId(b.id); setPicking(false); setPickQ(''); }} className="hover-row"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 0, background: b.id === boardId ? 'var(--color-accent-100)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14.5, textAlign: 'left', color: 'var(--color-text)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: TONE_SQ[b.tone] }} />{b.path.join(' › ')}
                  </button>
                ))}
              </div>
            )}
            {type !== 'team' && type !== 'event' && suggested.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 12.5, color: 'var(--color-neutral-700)', alignItems: 'center', flexWrap: 'wrap' }}>
                Suggested: {suggested.map((b) => <button key={b.id} onClick={() => setBoardId(b.id)} className="tag tag-neutral" style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{b.path[b.path.length - 1]}</button>)}
              </div>
            )}
          </div>
          <div>
            <Label>Posting as</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', background: 'var(--color-surface)', borderRadius: 2 }}>
              {asSociety ? <Avatar society={asSociety} size={28} /> : <Avatar person={me} size={28} />}
              <span style={{ font: '600 15px var(--font-heading)' }}>{asSociety ? asSociety.name : `@${me.handle}`}</span>
              {!asSociety && flair(me.branch_code, me.grad_year) && <Tag>{flair(me.branch_code, me.grad_year)}</Tag>}
              {societies.length > 0 && <select aria-label="Posting account" value={asSociety?.id ?? ''} onChange={(e) => setAsSociety(societies.find((s) => s.id === e.target.value) ?? null)} style={{ marginLeft: 'auto', maxWidth: 160, fontSize: 13, border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontFamily: 'var(--font-body)' }}>
                {type !== 'event' && <option value="">Personal</option>}
                {societies.map((society) => <option key={society.id} value={society.id}>{society.name}</option>)}
              </select>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 8 }}>{asSociety ? 'Posts as the verified society, with its badge.' : 'Your branch and year flair show on the post.'}</div>
          </div>
        </div>

        <div style={{ marginTop: 34 }}>
          <Label>Title</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 140))} placeholder="Make it specific — e.g. “DSA unit 4 notes for COE sem 3?”" aria-label="Title"
            style={{ width: '100%', border: 'none', borderBottom: '2px solid var(--color-text)', background: 'transparent', padding: '6px 0 12px', font: '600 30px/1.2 var(--font-heading)', color: 'var(--color-text)', outline: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 6 }}><span>{hint}</span><span>{tl}/140</span></div>
        </div>

        <div style={{ marginTop: 28 }}>
          <Label>Body</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 6, background: 'var(--color-surface)', borderRadius: '2px 2px 0 0', borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
            {FORMATS.map(([ic, before, after, placeholder]) => (
              <button key={ic} className="btn btn-icon" onClick={() => wrap(before, after, placeholder)} aria-label={ic}><Icon name={ic} size={18} /></button>
            ))}
            <span style={{ width: 1, height: 22, background: 'var(--color-divider)', margin: '0 6px' }} />
            <button className="btn btn-icon" onClick={() => imgRef.current?.click()} aria-label="Insert image"><Icon name="image" size={18} /></button>
            {(type === 'thread' || type === 'question' || type === 'poll') && <button className="btn btn-icon" onClick={() => fileRef.current?.click()} aria-label="Attach"><Icon name="paperclip" size={18} /></button>}
            <span className="hide-mobile" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-neutral-700)', paddingRight: 8 }}>Markdown + LaTeX supported</span>
          </div>
          {preview
            ? <div style={{ minHeight: 180, padding: '10px 14px', background: 'var(--color-surface)', borderRadius: '0 0 2px 2px' }}><Markdown source={text || '*Nothing to preview yet.*'} size={16} /></div>
            : <textarea ref={body} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add context. What have you tried? Which branch, semester, professor?" style={{ borderRadius: '0 0 2px 2px', minHeight: 180, font: '400 16px/1.6 var(--font-body)', borderTop: 'none', display: 'block' }} />}
          <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            if (f.size > 10 * 1048576) { toast('Images can be up to 10 MB.'); return; }
            toast('Uploading image…');
            try { const url = await uploadImage(supabaseBrowser(), me.id, f, f.name, f.type); setText((t) => `${t}${t && !t.endsWith('\n') ? '\n\n' : ''}![${f.name.replace(/\.[^.]+$/, '')}](${url})\n`); }
            catch (err) { toast((err as Error).message); }
          }} />
          {(type === 'thread' || type === 'question' || type === 'poll') && <><div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '12px 14px', border: '1px dashed var(--color-neutral-400)', borderRadius: 2, fontSize: 14, color: 'var(--color-neutral-700)', cursor: 'pointer', flexWrap: 'wrap' }}>
            <Icon name="upload-simple" size={20} color="var(--color-accent)" />
            {file ? <>{file.name} · file it under
              <select className="input" value={fileSubject} onClick={(e) => e.stopPropagation()} onChange={(e) => setFileSubject(e.target.value)} style={{ width: 'auto', height: 32 }}>
                <option value="">pick a subject…</option>{subjects.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
              </select></>
              : <>Drop PDFs, notes or images · files also get filed in the <Link href="/library" onClick={(e) => e.stopPropagation()}>Library</Link> under this subject</>}
          </div>
          {file && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
            <label htmlFor="attachment-kind">File type</label>
            <select id="attachment-kind" className="input" value={fileKind} onChange={(e) => setFileKind(e.target.value as typeof fileKind)} style={{ width: 'auto', height: 32 }}>
              <option value="notes">Notes</option><option value="pyq">PYQ</option><option value="lab">Lab</option><option value="slides">Slides</option>
            </select>
            <button className="btn btn-ghost" onClick={() => setFile(null)}>Remove</button>
          </div>}</>}
        </div>

        {type === 'poll' && (
          <div style={{ marginTop: 28 }}>
            <Label>Poll options</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
              {pollOpts.map((o, i) => <input key={i} className="input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setPollOpts(pollOpts.map((x, k) => (k === i ? e.target.value : x)))} />)}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, flexWrap: 'wrap' }}>
                <a onClick={() => pollOpts.length < 8 && setPollOpts([...pollOpts, ''])} style={{ fontWeight: 600 }}>+ Add option</a>
                <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-700)' }}>Closes in</span>
                <div className="seg">{[[1, '1 day'], [3, '3 days'], [7, '1 week']].map(([d, l]) => <label key={d} className="seg-opt"><input type="radio" name="dur" checked={pollDays === d} onChange={() => setPollDays(d as number)} />{l}</label>)}</div>
              </div>
            </div>
          </div>
        )}
        {type === 'team' && (
          <div className="grid-2" style={{ marginTop: 28, gap: 20 }}>
            <div><Label>Event / hackathon</Label><input className="input" placeholder="Smart India Hackathon 2026" value={team.event} onChange={(e) => setTeam({ ...team, event: e.target.value })} /></div>
            <div><Label>Applications close</Label><input className="input" type="date" value={team.closes} onChange={(e) => setTeam({ ...team, closes: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Kind</Label>
              <div className="seg" style={{ marginBottom: 14 }}>{[['hackathon', 'Hackathon'], ['project', 'Project'], ['competition', 'Competition'], ['research', 'Research']].map(([k, l]) => <label key={k} className="seg-opt"><input type="radio" name="tk" checked={team.category === k} onChange={() => setTeam({ ...team, category: k })} />{l}</label>)}</div>
              <Label>Roles</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {team.roles.map((r, i) => (
                  <button key={i} className={`tag ${r.filled ? 'tag-neutral' : 'tag-accent'}`} title="Click to toggle filled/open; double-click to remove" style={{ padding: '6px 12px', fontSize: 13, border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                    onClick={() => setTeam({ ...team, roles: team.roles.map((x, k) => (k === i ? { ...x, filled: !x.filled } : x)) })}
                    onDoubleClick={() => setTeam({ ...team, roles: team.roles.filter((_, k) => k !== i) })}>{r.name} · {r.filled ? 'filled' : 'open'}</button>
                ))}
                <input className="input" placeholder="+ Add role" value={team.roleDraft} onChange={(e) => setTeam({ ...team, roleDraft: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && team.roleDraft.trim()) { e.preventDefault(); setTeam({ ...team, roles: [...team.roles, { name: team.roleDraft.trim(), filled: false }], roleDraft: '' }); } }}
                  style={{ width: 160, minHeight: 30, height: 30, border: '1px solid var(--color-accent)', background: 'transparent' }} />
              </div>
            </div>
          </div>
        )}
        {type === 'event' && (
          <div className="grid-3" style={{ marginTop: 28, gap: 20 }}>
            <div><Label>Kind</Label><div className="seg">{[['event', 'Event'], ['recruiting', 'Recruiting'], ['workshop', 'Workshop'], ['talk', 'Talk']].map(([k, l]) => <label key={k} className="seg-opt"><input type="radio" name="ek" checked={ev.kind === k} onChange={() => setEv({ ...ev, kind: k })} />{l}</label>)}</div></div>
            <div><Label>When</Label><input className="input" placeholder="Fri 23 Oct · 5:00 pm" value={ev.when} onChange={(e) => setEv({ ...ev, when: e.target.value })} /></div>
            <div><Label>Where</Label><input className="input" placeholder="SPS-12" value={ev.where} onChange={(e) => setEv({ ...ev, where: e.target.value })} /></div>
            {ev.kind !== 'recruiting' && <div style={{ gridColumn: '1 / -1' }}><Label>Start date and time (for reminders)</Label><input className="input" type="datetime-local" value={ev.starts} onChange={(e) => setEv({ ...ev, starts: e.target.value })} /></div>}
            {ev.kind === 'recruiting' && <div style={{ gridColumn: '1 / -1' }}><Label>Application link</Label><input className="input" type="url" placeholder="https://…" value={ev.applyUrl} onChange={(e) => setEv({ ...ev, applyUrl: e.target.value })} /></div>}
            <div style={{ gridColumn: '1 / -1' }}><Label>Poster image</Label><input type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />{poster && <div style={{ marginTop: 5, fontSize: 13 }}>{poster.name}</div>}</div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--color-neutral-800)' }}>
              <Icon name="seal-check" size={20} color="var(--color-accent)" />
              {societies.length ? <>Posting as a verified society shows the badge and lists this on the <Link href="/societies">Society board</Link> and the Today timeline.</> : <>Only verified society accounts can post here. Ask your society’s admin to add you.</>}
            </div>
          </div>
        )}
        {type === 'article' && (
          <div style={{ marginTop: 28, padding: '16px 18px', background: 'var(--color-accent-100)', borderRadius: 2, fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-accent-900)', display: 'flex', gap: 12 }}>
            <Icon name="users-four" size={22} color="var(--color-accent-700)" />
            <div><b>Wiki articles are shared.</b> A moderator reviews new guides and edits before they go live; every editor is credited. Start from a template:{' '}
              <a onClick={() => setText('### What this guide covers\n\n\n### Step by step\n\n\n### Common mistakes\n\n')}>Guide</a> · <a onClick={() => setText('### Month 1\n\n\n### Month 2\n\n\n### Resources\n\n')}>Roadmap</a> · <a onClick={() => setText('### How the course is graded\n\n\n### Units that matter\n\n\n### PYQs and notes\n\n')}>Subject survival</a>
            </div>
          </div>
        )}
        {type === 'article' && <div style={{ marginTop: 16 }}><Label>Cover image</Label><input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />{cover && <div style={{ marginTop: 5, fontSize: 13 }}>{cover.name}</div>}</div>}

        {(type === 'thread' || type === 'question' || type === 'poll') && (
          <div style={{ marginTop: 28 }}>
            <Label>Tags</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 2 }}>
              {tags.map((t) => <button key={t} className="tag tag-accent" onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t} ×</button>)}
              <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag}
                placeholder="Add a tag…" style={{ flex: 1, minWidth: 120, border: 0, background: 'transparent', outline: 'none', font: '400 14px var(--font-body)', color: 'var(--color-text)' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 34, paddingTop: 20, borderTop: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
          {(type === 'thread' || type === 'question' || type === 'poll') && <label className="radio"><input type="checkbox" checked={notifyReplies} onChange={(e) => setNotifyReplies(e.target.checked)} /><span className="dot" />Notify me about replies</label>}
          <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={save}>Save draft</button>
          <button className="btn btn-secondary" onClick={() => setPreview(!preview)}><Icon name="eye" size={17} />{preview ? 'Edit' : 'Preview'}</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}><Icon name="paper-plane-tilt" size={17} />Post</button>
        </div>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 36, paddingTop: 120 }}>
        <div>
          <h6 style={{ margin: '0 0 12px', color: 'var(--color-neutral-700)' }}>Already asked?</h6>
          {similar.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {similar.map((s) => (
                <Link key={s.route} href={s.route} className="title-link">
                  <div style={{ font: '600 16px/1.3 var(--font-heading)' }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 3 }}>{s.sub}</div>
                </Link>
              ))}
            </div>
          ) : <div style={{ fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.5 }}>Start typing a title — we&apos;ll show similar threads so the answer you need might already be here.</div>}
        </div>
        {board && board.rules.length > 0 && type !== 'team' && type !== 'event' && (
          <div>
            <h6 style={{ margin: '0 0 12px', color: 'var(--color-neutral-700)' }}>Board rules · {board.path[board.path.length - 1]}</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-800)' }}>{board.rules.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}</div>
          </div>
        )}
        <div>
          <h6 style={{ margin: '0 0 12px', color: 'var(--color-neutral-700)' }}>Good posts get</h6>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-neutral-800)' }}>+10 karma per upvote, +25 when your reply is accepted.</div>
        </div>
      </aside>
    </div>
  );
}
