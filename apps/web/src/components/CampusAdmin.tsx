'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAMPUS_SECTIONS, deleteCampusItem, saveCampusItem, type CampusItem, type CampusKind } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useShell } from './shell/Shell';

/** Plain forms for the content behind Today, the exam countdown, Team Up deadlines, societies and the Lounge rooms. */
export function CampusAdmin({ data, isAdmin }: { data: Record<CampusKind, CampusItem[]>; isAdmin: boolean }) {
  const kinds: CampusKind[] = isAdmin ? ['event', 'exam', 'deadline', 'society', 'room'] : ['event', 'exam', 'deadline', 'society'];
  return (
    <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', gap: 40 }}>
      {kinds.map((kind) => (
        <section key={kind}>
          <h3 style={{ marginBottom: 6 }}>
            {CAMPUS_SECTIONS[kind].title} · {data[kind].length}
          </h3>
          {data[kind].map((item) => (
            <ItemForm key={item.id} kind={kind} item={item} />
          ))}
          <ItemForm kind={kind} item={null} />
        </section>
      ))}
    </div>
  );
}

function ItemForm({ kind, item }: { kind: CampusKind; item: CampusItem | null }) {
  const router = useRouter();
  const { toast } = useShell();
  const fields = CAMPUS_SECTIONS[kind].fields;
  const [v, setV] = useState<Record<string, string>>(item?.values ?? {});
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, msg: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      after?.();
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const id = `${kind}-${item?.id ?? 'new'}`;
  return (
    <form
      className="row-rule"
      style={{ padding: '16px 0' }}
      aria-label={
        item ? `Edit ${item.values.title ?? item.values.label ?? item.values.name ?? item.id}` : `Add to ${CAMPUS_SECTIONS[kind].title}`
      }
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveCampusItem(supabaseBrowser(), kind, item?.id ?? null, v),
          item ? 'Saved.' : 'Added.',
          () => !item && setV({}),
        );
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {fields.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`${id}-${f.key}`}>{f.label}</label>
            {f.type === 'bool' ? (
              <input
                id={`${id}-${f.key}`}
                type="checkbox"
                checked={v[f.key] === 'true'}
                onChange={(e) => setV({ ...v, [f.key]: e.target.checked ? 'true' : '' })}
              />
            ) : (
              <input
                id={`${id}-${f.key}`}
                className="input"
                style={{ height: 38 }}
                value={v[f.key] ?? ''}
                placeholder={f.hint}
                type={f.type === 'datetime' ? 'datetime-local' : f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                disabled={(kind === 'room' || kind === 'society') && f.key === 'slug' && !!item}
                onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
        {item && kind !== 'room' && kind !== 'society' && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              confirm('Delete this for everyone?') && run(() => deleteCampusItem(supabaseBrowser(), kind, item.id), 'Deleted.')
            }
          >
            Delete
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {item ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}
