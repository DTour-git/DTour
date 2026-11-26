'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addSocietyMember, removeSocietyMember, updateSocietyMember, type MySociety, type SocietyMember } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from './Icon';
import { Avatar } from './ui';
import { useShell } from './shell/Shell';

/** Societies I belong to (#62): anyone can leave; leads manage members. Not in the design; same box style as the profile sidebar. */
export function MySocieties({ societies, myId }: { societies: MySociety[]; myId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="px" style={{ paddingTop: 28 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 2, padding: '20px 22px' }}>
        <h4 style={{ margin: '0 0 4px' }}>Your societies</h4>
        {societies.map((m) => (
          <div key={m.society.id} className="row-rule" style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ font: '600 17px/1.3 var(--font-heading)' }}>{m.society.name}</span>
              {m.society.verified && <Icon name="seal-check" size={15} color="var(--color-accent)" />}
              <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                {m.role}
                {m.is_lead ? ' · lead' : ''}
                {m.can_post ? ' · can post' : ''}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {m.is_lead && (
                  <button className="btn btn-ghost" onClick={() => setOpen(open === m.society.id ? null : m.society.id)}>
                    {open === m.society.id ? 'Done' : 'Manage'}
                  </button>
                )}
                <Leave societyId={m.society.id} myId={myId} name={m.society.name} />
              </span>
            </div>
            {m.is_lead && open === m.society.id && <Manage society={m} myId={myId} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function useAct() {
  const router = useRouter();
  const { toast, requireMe } = useShell();
  const [busy, setBusy] = useState(false);
  // purpose 'own': leaving is housekeeping a suspension still allows (#64).
  const act = async (fn: () => Promise<void>, msg?: string, purpose?: 'own') => {
    if (!requireMe(purpose)) return false;
    setBusy(true);
    try {
      await fn();
      if (msg) toast(msg);
      router.refresh();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { act, busy };
}

function Leave({ societyId, myId, name }: { societyId: string; myId: string; name: string }) {
  const { act, busy } = useAct();
  return (
    <button
      className="btn btn-secondary"
      disabled={busy}
      onClick={() =>
        confirm(`Leave ${name}?`) && act(() => removeSocietyMember(supabaseBrowser(), societyId, myId), `You left ${name}.`, 'own')
      }
    >
      Leave
    </button>
  );
}

function Manage({ society, myId }: { society: MySociety; myId: string }) {
  const { act, busy } = useAct();
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const id = society.society.id;
  return (
    <div style={{ marginTop: 10 }}>
      {society.members.map((mem) => (
        <MemberRow key={mem.user_id} societyId={id} member={mem} me={mem.user_id === myId} />
      ))}
      <form
        aria-label={`Add a member to ${society.society.name}`}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(() => addSocietyMember(supabaseBrowser(), id, handle, role), 'Added.');
          if (ok) {
            setHandle('');
            setRole('');
          }
        }}
      >
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label htmlFor={`add-${id}-handle`}>Handle</label>
          <input
            id={`add-${id}-handle`}
            className="input"
            style={{ height: 38 }}
            value={handle}
            placeholder="aarav.k"
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label htmlFor={`add-${id}-role`}>Role</label>
          <input
            id={`add-${id}-role`}
            className="input"
            style={{ height: 38 }}
            value={role}
            placeholder="Member"
            maxLength={40}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !handle.trim()}>
          Add member
        </button>
      </form>
    </div>
  );
}

function MemberRow({ societyId, member, me }: { societyId: string; member: SocietyMember; me: boolean }) {
  const { act, busy } = useAct();
  const [role, setRole] = useState(member.role);
  const sb = supabaseBrowser;
  const handle = `@${member.person.handle}`;
  return (
    <div className="row-rule" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', flexWrap: 'wrap' }}>
      <Avatar person={member.person} size={28} />
      <span style={{ fontWeight: 600, minWidth: 110 }}>{handle}</span>
      <input
        className="input"
        aria-label={`Role of ${handle}`}
        style={{ height: 34, width: 170 }}
        value={role}
        maxLength={40}
        onChange={(e) => setRole(e.target.value)}
        onBlur={() =>
          role.trim() !== member.role && act(() => updateSocietyMember(sb(), societyId, member.user_id, { role: role.trim() }), 'Saved.')
        }
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={member.can_post}
          disabled={busy}
          onChange={(e) => act(() => updateSocietyMember(sb(), societyId, member.user_id, { can_post: e.target.checked }))}
        />
        Can post
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={member.is_lead}
          disabled={busy}
          onChange={(e) => act(() => updateSocietyMember(sb(), societyId, member.user_id, { is_lead: e.target.checked }))}
        />
        Lead
      </label>
      {!me && (
        <button
          className="btn btn-ghost"
          style={{ marginLeft: 'auto' }}
          disabled={busy}
          onClick={() =>
            confirm(`Remove ${handle}?`) && act(() => removeSocietyMember(sb(), societyId, member.user_id), `Removed ${handle}.`)
          }
        >
          Remove
        </button>
      )}
    </div>
  );
}
