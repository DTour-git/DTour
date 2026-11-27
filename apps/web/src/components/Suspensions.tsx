'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SUSPENSION_DAYS,
  agoLong,
  atHandle,
  suspendedWho,
  clock,
  liftSuspension,
  shortDate,
  suspendMember,
  suspensionActive,
  type Suspension,
} from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useShell } from './shell/Shell';

const until = (s: { ends_at: string | null }) => (s.ends_at ? `until ${shortDate(s.ends_at)}, ${clock(s.ends_at, false)}` : 'indefinitely');

/** Suspend a member from writing (#64). Not in the design; same forms as the campus editor. */
export function SuspendForm({ handle = '', reason = '', onDone }: { handle?: string; reason?: string; onDone?: () => void }) {
  const router = useRouter();
  const { toast } = useShell();
  const [h, setH] = useState(handle);
  const [why, setWhy] = useState(reason);
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const id = `suspend-${handle || 'new'}`;
  return (
    <form
      aria-label={handle ? `Suspend @${handle}` : 'Suspend a member'}
      style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 0' }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await suspendMember(supabaseBrowser(), h, why, days ? Number(days) : null);
          toast(`@${h.replace(/^@/, '')} is suspended.`);
          setH(handle);
          setWhy(reason);
          onDone?.();
          router.refresh();
        } catch (err) {
          toast((err as Error).message);
        }
        setBusy(false);
      }}
    >
      <div className="field" style={{ flex: '1 1 150px' }}>
        <label htmlFor={`${id}-handle`}>Handle</label>
        <input
          id={`${id}-handle`}
          className="input"
          style={{ height: 38 }}
          value={h}
          placeholder="aarav.k"
          onChange={(e) => setH(e.target.value)}
        />
      </div>
      <div className="field" style={{ flex: '3 1 260px' }}>
        <label htmlFor={`${id}-reason`}>Reason (the member sees this)</label>
        <input
          id={`${id}-reason`}
          className="input"
          style={{ height: 38 }}
          value={why}
          maxLength={500}
          placeholder="Repeated spam in the Lounge"
          onChange={(e) => setWhy(e.target.value)}
        />
      </div>
      <div className="field" style={{ flex: '1 1 130px' }}>
        <label htmlFor={`${id}-days`}>For</label>
        <select id={`${id}-days`} className="input" style={{ height: 38 }} value={days} onChange={(e) => setDays(e.target.value)}>
          {SUSPENSION_DAYS.map(([d, label]) => (
            <option key={label} value={d ?? ''}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || !h.trim() || !why.trim()}>
        Suspend
      </button>
    </form>
  );
}

/** The /mod section: suspend by handle, active suspensions with Lift, and the log. */
export function Suspensions({ items }: { items: Suspension[] }) {
  const router = useRouter();
  const { toast } = useShell();
  const [busy, setBusy] = useState<number | null>(null);
  const active = items.filter((s) => suspensionActive(s));
  const lift = async (s: Suspension) => {
    if (!confirm(`Lift ${suspendedWho(s)}’s suspension?`)) return;
    setBusy(s.id);
    try {
      await liftSuspension(supabaseBrowser(), s.id);
      toast('Suspension lifted.');
      router.refresh();
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(null);
  };
  return (
    <section style={{ marginTop: 40 }}>
      <h3 style={{ marginBottom: 6 }}>Suspensions · {active.length} active</h3>
      <div style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>
        A suspended member can still read, but can’t post, reply, vote, RSVP, use the Lounge, upload or edit their profile. Only admins can
        suspend moderators.
      </div>
      <SuspendForm />
      {active.map((s) => (
        <div
          key={s.id}
          className="row-rule"
          style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', padding: '12px 0' }}
        >
          <b>{suspendedWho(s)}</b>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>
            {until(s)} · {s.reason}
          </span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} disabled={busy === s.id} onClick={() => lift(s)}>
            Lift
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <>
          <h4 style={{ margin: '24px 0 4px' }}>Log</h4>
          {items.map((s) => (
            <div key={s.id} className="row-rule" style={{ fontSize: 14, padding: '8px 0', color: 'var(--color-neutral-800)' }}>
              {s.by ? atHandle(s.by) : 'A moderator'} suspended <b>{suspendedWho(s)}</b> {until(s)} · {agoLong(s.created_at)} · “{s.reason}”
              {s.lifted_at && (
                <>
                  {' '}
                  · lifted by {s.lifter ? atHandle(s.lifter) : 'a moderator'} {agoLong(s.lifted_at)}
                </>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
