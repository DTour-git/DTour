'use client';

import Link from 'next/link';
import { useShell } from './shell/Shell';

export function WhosOnline({ newest, record }: { newest: { handle: string; flair: string | null } | null; record: { n: number; label: string | null } }) {
  const { online } = useShell();
  const shown = online.slice(0, 7);
  return (
    <div className="mx" style={{ marginTop: 44, padding: '22px 26px', background: 'var(--color-surface)', borderRadius: 2, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 24, alignItems: 'center' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 16px var(--font-heading)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />Who&apos;s online · {online.length}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 6, color: 'var(--color-neutral-800)' }}>
          {shown.map((u, i) => <span key={u.id}>{i > 0 && ', '}<Link href={`/u/${u.handle}`}>{u.handle}</Link></span>)}
          {online.length > shown.length && <> and {online.length - shown.length} others</>}
        </div>
      </div>
      <div className="hide-mobile" style={{ textAlign: 'right', fontSize: 13.5, color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
        {newest && <>Newest member: <b style={{ color: 'var(--color-text)' }}>@{newest.handle}</b>{newest.flair && ` (${newest.flair})`}<br /></>}
        Most online ever: {record.n.toLocaleString('en-US')}{record.label ? ` on ${record.label}` : ''}
      </div>
    </div>
  );
}
