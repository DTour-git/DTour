'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { flair, handleStatus, handleStatusMessage, normalizeHandle, updateProfile, type BranchRow, type ProfileRow } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Avatar, LogoMark, Tag } from '@/components/ui';
import { HandleHint } from '@/components/HandleHint';
import { useHandleCheck } from '@/lib/useHandleCheck';


export function OnboardingForm({ profile, email, branches }: { profile: ProfileRow; email: string | null; branches: BranchRow[] }) {
  const router = useRouter();
  const [handle, setHandle] = useState(profile.handle);
  const [branch, setBranch] = useState(profile.branch_code ?? '');
  const [grad, setGrad] = useState(profile.grad_year ? String(profile.grad_year) : '');
  const [sem, setSem] = useState(profile.semester ? String(profile.semester) : '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const year = new Date().getFullYear();
  const check = useHandleCheck(handle, profile.handle);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = normalizeHandle(handle);
    setBusy(true); setError(null);
    const sb = supabaseBrowser();
    try {
      const msg = handleStatusMessage(await handleStatus(sb, h), h);
      if (msg) throw new Error(msg);
      await updateProfile(sb, profile.id, {
        handle: h, branch_code: branch || null, grad_year: grad ? Number(grad) : null,
        semester: sem ? Number(sem) : null, bio: bio.trim() || null, onboarded: true,
      });
      router.replace('/');
      router.refresh();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '10vh 20px 40px', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <form onSubmit={submit} style={{ width: 'min(520px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoMark size={26} /><span style={{ font: '600 28px/1 var(--font-heading)', letterSpacing: '-.03em' }}>DTour</span>
        </div>
        <h1 style={{ fontSize: 40, margin: '26px 0 8px', letterSpacing: '-.025em' }}>Welcome to campus.</h1>
        <p style={{ font: 'italic 400 18px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', margin: '0 0 26px' }}>
          Pick a handle — it’s how DTour knows you, and you can change it later from your profile. Your branch and batch show as a flair on everything you post.
        </p>
        {email && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginBottom: 20 }}>Signed in as {email}</div>}

        <label className="label-caps" htmlFor="handle" style={{ display: 'block' }}>Handle</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid var(--color-text)', paddingBottom: 8 }}>
          <span style={{ font: '600 26px var(--font-heading)', color: 'var(--color-neutral-600)' }}>@</span>
          <input id="handle" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={24} autoComplete="off"
            style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', font: '600 26px var(--font-heading)', color: 'var(--color-text)' }} />
        </div>
        <HandleHint check={check} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 26 }}>
          <div>
            <label className="label-caps" htmlFor="branch" style={{ display: 'block' }}>Branch</label>
            <select id="branch" className="input" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ height: 42 }}>
              <option value="">—</option>
              {branches.map((b) => <option key={b.code} value={b.code}>{b.code} · {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label-caps" htmlFor="grad" style={{ display: 'block' }}>Graduating</label>
            <select id="grad" className="input" value={grad} onChange={(e) => setGrad(e.target.value)} style={{ height: 42 }}>
              <option value="">—</option>
              {Array.from({ length: 6 }, (_, i) => year - 1 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label-caps" htmlFor="sem" style={{ display: 'block' }}>Semester</label>
            <select id="sem" className="input" value={sem} onChange={(e) => setSem(e.target.value)} style={{ height: 42 }}>
              <option value="">—</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
        </div>

        <label className="label-caps" htmlFor="bio" style={{ display: 'block', marginTop: 26 }}>One line about you <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
        <input id="bio" className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Learning backend, usually at the H-4 canteen." style={{ height: 42 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28, padding: '14px 16px', background: 'var(--color-surface)', borderRadius: 2 }}>
          <Avatar person={{ handle: handle || 'you', tint: profile.tint as never }} size={36} />
          <b style={{ font: '600 16px var(--font-heading)' }}>@{handle || 'you'}</b>
          {flair(branch, grad ? Number(grad) : null) && <Tag>{flair(branch, Number(grad))}</Tag>}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-neutral-700)' }}>Preview</span>
        </div>

        {error && <div role="alert" style={{ marginTop: 16, padding: '12px 14px', background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-800)', borderRadius: 2, fontSize: 14 }}>{error}</div>}
        <button className="btn btn-primary" disabled={busy || !check.ok} style={{ width: '100%', height: 46, marginTop: 22, fontSize: 15 }}>Enter DTour</button>
      </form>
    </main>
  );
}
