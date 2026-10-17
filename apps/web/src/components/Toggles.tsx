'use client';

import { useState } from 'react';
import { n, toggleHeart, toggleRsvp, toggleTeamRequest } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from './Icon';
import { useShell } from './shell/Shell';

/** RSVP with an optimistic count ("140 going" → "141 going"). */
export function Rsvp({ postId, going, count, word, featured, label = "I'm going" }: { postId: number; going: boolean; count: number; word: string; featured?: boolean; label?: string }) {
  const { toast, requireMe } = useShell();
  const [g, setG] = useState(going);
  const [c, setC] = useState(count);
  const toggle = async () => {
    if (!requireMe()) return;
    setG(!g); setC(c + (g ? -1 : 1));
    try { await toggleRsvp(supabaseBrowser(), postId); } catch { setG(g); setC(c); toast('Could not RSVP.'); }
  };
  return (
    <>
      <span>{n(c)} {word}</span>
      <button className={`btn ${featured ? 'btn-secondary' : g ? 'btn-primary' : 'btn-secondary'}`} style={{ marginLeft: 'auto' }} onClick={toggle} aria-pressed={g}>
        {g ? 'Going ✓' : label}
      </button>
    </>
  );
}

export function AskToJoin({ teamId, requested, primary }: { teamId: number; requested: boolean; primary?: boolean }) {
  const { toast, requireMe } = useShell();
  const [r, setR] = useState(requested);
  const toggle = async () => {
    if (!requireMe()) return;
    setR(!r);
    try { await toggleTeamRequest(supabaseBrowser(), teamId); if (!r) toast('Request sent to the team.'); } catch { setR(r); }
  };
  return <button className={`btn ${primary || r ? 'btn-primary' : 'btn-secondary'}`} style={{ marginLeft: 'auto' }} onClick={toggle} aria-pressed={r}>{r ? 'Requested ✓' : 'Ask to join'}</button>;
}

export function Heart({ placeId, hearted, count, size = 16 }: { placeId: number; hearted: boolean; count: number; size?: number }) {
  const { requireMe } = useShell();
  const [h, setH] = useState(hearted);
  const [c, setC] = useState(count);
  const toggle = async () => {
    if (!requireMe()) return;
    setH(!h); setC(c + (h ? -1 : 1));
    try { await toggleHeart(supabaseBrowser(), placeId); } catch { setH(h); setC(c); }
  };
  return (
    <button onClick={toggle} aria-pressed={h} aria-label="Heart" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-accent-700)', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}>
      <Icon name="heart" size={size} weight={h ? 'fill' : 'duotone'} />{c >= 1000 ? `${(c / 1000).toFixed(1).replace(/\.0$/, '')}k` : c}
    </button>
  );
}
