'use client';

import { useEffect, useState } from 'react';
import { getSuspensionHistory, setMemberSuspension } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useShell } from './shell/Shell';

type History = Awaited<ReturnType<typeof getSuspensionHistory>>;

export function Suspensions() {
  const [handle, setHandle] = useState('');
  const [reason, setReason] = useState('');
  const [end, setEnd] = useState('');
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<History>([]);
  const { toast } = useShell();
  const reload = async () => setHistory(await getSuspensionHistory(supabaseBrowser()));
  useEffect(() => { getSuspensionHistory(supabaseBrowser()).then(setHistory).catch((e) => toast(e.message)); }, [toast]);
  const submit = async (suspend: boolean) => {
    if (!handle.trim() || !reason.trim()) { toast('Enter a member handle and reason.'); return; }
    setBusy(true);
    try {
      await setMemberSuspension(supabaseBrowser(), handle, reason, end ? new Date(end).toISOString() : null, share, suspend);
      setReason(''); await reload(); toast(suspend ? 'Member suspended.' : 'Suspension lifted.');
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section>
    <h3>Member suspensions</h3>
    <p>Enter a member’s handle. Leave the end date empty for an indefinite suspension. A reason is required for the moderator record.</p>
    <div style={{ display: 'grid', gap: 10 }}>
      <label>Member handle<input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" /></label>
      <label>Reason<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></label>
      <label>End date and time (optional)<input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      <label><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Show the reason to the member</label>
      <div style={{ display: 'flex', gap: 10 }}><button className="btn btn-primary" disabled={busy} onClick={() => submit(true)}>Suspend member</button><button className="btn btn-secondary" disabled={busy} onClick={() => submit(false)}>Lift suspension</button></div>
    </div>
    <h4 style={{ marginTop: 24 }}>Suspension history</h4>
    {history.map((e) => <div className="row-rule" style={{ padding: '10px 0' }} key={e.id}><b>@{e.handle}</b> · {e.action === 'suspend' ? 'suspended' : 'suspension lifted'} by @{e.actor_handle} · {new Date(e.created_at).toLocaleString()}<div>{e.reason}{e.action === 'suspend' && <> · {e.ends_at ? `until ${new Date(e.ends_at).toLocaleString()}` : 'indefinite'} · reason {e.share_reason ? 'shared' : 'private'}</>}</div></div>)}
    {!history.length && <p>No suspension history.</p>}
  </section>;
}
