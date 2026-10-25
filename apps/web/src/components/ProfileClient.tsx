'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeHandle, nextHandleChange, updateProfile, type ProfileRow } from '@dtour/shared';
import { HandleHint } from './HandleHint';
import { useHandleCheck } from '@/lib/useHandleCheck';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from './Icon';
import { useShell } from './shell/Shell';

export function OpenToTeams({ profile, editable }: { profile: ProfileRow; editable: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(profile.open_to_teams);
  const [skills, setSkills] = useState(profile.skills);
  const [draft, setDraft] = useState('');
  const persist = async (patch: Partial<ProfileRow>) => { await updateProfile(supabaseBrowser(), profile.id, patch); router.refresh(); };
  const add = () => {
    const s = draft.trim();
    if (!s || skills.includes(s)) { setDraft(''); return; }
    const next = [...skills, s]; setSkills(next); setDraft(''); persist({ skills: next });
  };
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Open to teams</h4>
        {editable
          ? <button className={`tag ${on ? 'tag-accent' : 'tag-neutral'}`} style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }} onClick={() => { setOn(!on); persist({ open_to_teams: !on }); }}>{on ? 'On' : 'Off'}</button>
          : <span className={`tag ${on ? 'tag-accent' : 'tag-neutral'}`}>{on ? 'On' : 'Off'}</span>}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', margin: '6px 0 12px' }}>Shown on Team Up to people looking for:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {skills.map((s) => editable
          ? <button key={s} className="tag tag-neutral" title="Remove" style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }} onClick={() => { const next = skills.filter((x) => x !== s); setSkills(next); persist({ skills: next }); }}>{s}</button>
          : <span key={s} className="tag tag-neutral">{s}</span>)}
        {editable && <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} placeholder="+ add skill"
          className="tag tag-outline" style={{ width: 96, background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)' }} />}
      </div>
    </div>
  );
}

export function ProfileButtons({ profile }: { profile: ProfileRow }) {
  const { toast } = useShell();
  const router = useRouter();
  const [open, setOpen] = useState<'edit' | 'settings' | null>(null);
  const [handle, setHandle] = useState(profile.handle);
  const [error, setError] = useState<string | null>(null);
  const check = useHandleCheck(handle, profile.handle);
  const locked = nextHandleChange(profile);
  const [f, setF] = useState({ bio: profile.bio ?? '', hostel: profile.hostel ?? '', github: profile.github ?? '', linkedin: profile.linkedin ?? '', semester: profile.semester ?? 1 });
  const save = async () => {
    setError(null);
    try {
      const sb = supabaseBrowser();
      const next = check.handle;
      if (next !== profile.handle) await changeHandle(sb, profile.id, next);
      await updateProfile(sb, profile.id, { bio: f.bio || null, hostel: f.hostel || null, github: f.github || null, linkedin: f.linkedin || null, semester: Number(f.semester) });
      setOpen(null); toast('Profile updated.');
      if (next !== profile.handle) router.replace(`/u/${next}`);
      router.refresh();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
      <button className="btn btn-secondary" onClick={() => setOpen('settings')}><Icon name="gear-six" size={17} />Settings</button>
      <button className="btn btn-primary" onClick={() => setOpen('edit')}><Icon name="pencil-simple-line" size={17} />Edit profile</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(null)} style={{ zIndex: 40 }}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg)' }}>
            {open === 'edit' ? <>
              <div className="dialog-title">Edit profile</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ font: '600 17px var(--font-heading)', color: 'var(--color-neutral-600)' }}>@</span>
                <input className="input" aria-label="Handle" value={handle} maxLength={24} autoComplete="off" disabled={!!locked}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())} style={{ flex: 1 }} />
              </label>
              {locked
                ? <div className="dialog-body" style={{ marginTop: -6 }}>You can change your handle again on {locked.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</div>
                : <>
                  <div style={{ marginTop: -10 }}><HandleHint check={check} /></div>
                  {check.status !== 'unchanged' && <div className="dialog-body" style={{ marginTop: -6 }}>
                    Posts that mention @{profile.handle} will update to @{check.handle || '…'}, and old links to your profile keep working for 30 days. You can change it again after 7 days.
                  </div>}
                </>}
              <textarea className="input" placeholder="Bio" value={f.bio} maxLength={200} onChange={(e) => setF({ ...f, bio: e.target.value })} style={{ minHeight: 70 }} />
              <input className="input" placeholder="Hostel — e.g. Hostel H-4" value={f.hostel} onChange={(e) => setF({ ...f, hostel: e.target.value })} />
              <input className="input" placeholder="GitHub username" value={f.github} onChange={(e) => setF({ ...f, github: e.target.value })} />
              <input className="input" placeholder="LinkedIn username" value={f.linkedin} onChange={(e) => setF({ ...f, linkedin: e.target.value })} />
              <select className="input" value={f.semester} onChange={(e) => setF({ ...f, semester: Number(e.target.value) })}>
                {Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>Semester {i + 1}</option>)}
              </select>
              {error && <div role="alert" style={{ fontSize: 14, color: 'var(--color-accent-2-700)' }}>{error}</div>}
              <div className="dialog-actions"><button className="btn btn-ghost" onClick={() => { setOpen(null); setError(null); setHandle(profile.handle); }}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={!check.ok}>Save</button></div>
            </> : <>
              <div className="dialog-title">Settings</div>
              <div className="dialog-body">Signed in to DTour with your DTU account.</div>
              <form action="/auth/signout" method="post" className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
                <button className="btn btn-secondary"><Icon name="sign-out" size={17} />Sign out</button>
              </form>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
