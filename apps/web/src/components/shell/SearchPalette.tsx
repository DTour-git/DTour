'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WEB_SCOPES, parseQuery, search, type RankedDoc } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '../Icon';
import { useShell } from './Shell';

const SCOPES = Object.keys(WEB_SCOPES);

export function SearchPalette() {
  const { searchOpen, closeSearch, initialQuery } = useShell();
  if (!searchOpen) return null;
  return <Palette initialQuery={initialQuery} onClose={closeSearch} />;
}

function Palette({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQuery);
  const [scope, setScope] = useState('All');
  const [sel, setSel] = useState(0);
  const [results, setResults] = useState<RankedDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    const id = ++seq.current;
    const t = window.setTimeout(async () => {
      const parsed = parseQuery(q, WEB_SCOPES[scope]);
      try {
        const r = await search(supabaseBrowser(), parsed.q, parsed.kind);
        if (id !== seq.current) return;
        setResults(r.results);
        setTotal(r.total);
        setSel(0);
      } finally { if (id === seq.current) setLoaded(true); }
    }, q ? 90 : 0);
    return () => window.clearTimeout(t);
  }, [q, scope]);

  const open = (r: RankedDoc | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.route);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); open(results[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      setScope((s) => SCOPES[(SCOPES.indexOf(s) + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length]);
    }
  };

  const p = results[Math.min(sel, results.length - 1)];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-neutral-900) 45%, transparent)', zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 80, fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <div role="dialog" aria-label="Search" onClick={(e) => e.stopPropagation()} style={{ width: 'min(960px, calc(100% - 32px))', height: 'min(540px, calc(100vh - 120px))', background: 'var(--color-bg)', boxShadow: 'var(--shadow-lg)', borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ font: '600 26px/1 var(--font-heading)', color: 'var(--color-accent-2)' }}>›</span>
          <input
            ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Fuzzy search threads, notes, people, places…  try “dsa pyq”, “@riya”, “#placements”"
            aria-label="Search query"
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', font: '400 20px var(--font-body)', color: 'var(--color-text)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', fontVariantNumeric: 'tabular-nums' }}>{results.length}/{total}</span>
          <button onClick={onClose} style={{ fontSize: 12, padding: '2px 7px', border: '1px solid var(--color-divider)', borderRadius: 2, color: 'var(--color-neutral-700)', background: 'none', cursor: 'pointer' }}>esc</button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid var(--color-divider)', fontSize: 13, overflowX: 'auto' }} className="no-scrollbar">
          {SCOPES.map((label) => (
            <button key={label} onClick={() => { setScope(label); input.current?.focus(); }}
              style={{ padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontWeight: 600, border: 0, font: 'inherit', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                background: scope === label ? 'var(--color-text)' : 'transparent', color: scope === label ? 'var(--color-bg)' : 'var(--color-neutral-800)' }}>
              {label}
            </button>
          ))}
          <span className="hide-mobile" style={{ marginLeft: 'auto', color: 'var(--color-neutral-700)', alignSelf: 'center', whiteSpace: 'nowrap' }}>tab to cycle</span>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', minHeight: 0 }}>
          <div style={{ overflow: 'auto', padding: '8px 0', borderRight: '1px solid var(--color-divider)' }}>
            {results.map((r, i) => (
              <div key={r.route + r.title} onClick={() => open(r)} onMouseEnter={() => setSel(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px 9px 0', cursor: 'pointer', background: i === sel ? 'var(--color-accent-100)' : 'transparent' }}>
                <span style={{ width: 4, alignSelf: 'stretch', marginRight: 12, background: i === sel ? 'var(--color-accent)' : 'transparent' }} />
                <Icon name={r.icon} size={18} color="var(--color-neutral-700)" />
                <span className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 15.5 }}>
                  {r.segs.map((g, k) => <span key={k} style={g.hit ? { color: 'var(--color-accent-2-700)', fontWeight: 700 } : undefined}>{g.text}</span>)}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', flex: 'none' }}>{r.kind}</span>
              </div>
            ))}
            {loaded && !results.length && (
              <div style={{ padding: '30px 22px', fontSize: 15, color: 'var(--color-neutral-700)' }}>
                Nothing matches. <a onClick={() => { onClose(); router.push(`/new?title=${encodeURIComponent(q)}`); }} style={{ fontWeight: 600 }}>Ask it as a new thread →</a>
              </div>
            )}
          </div>
          <div style={{ padding: '22px 24px', overflow: 'auto' }}>
            {p && (
              <>
                <div className="kicker" style={{ color: 'var(--color-accent-700)' }}>{p.kind}</div>
                <div style={{ font: '600 24px/1.2 var(--font-heading)', margin: '8px 0 6px' }}>{p.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{p.sub}</div>
                {p.body && <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--color-neutral-800)', margin: '16px 0 0' }}>{p.body}</p>}
                <div onClick={() => open(p)} style={{ marginTop: 18, fontSize: 13.5, fontWeight: 600, color: 'var(--color-accent-700)', cursor: 'pointer' }}>↵ Open {p.kind.toLowerCase()}</div>
              </>
            )}
          </div>
        </div>
        <div className="hide-mobile" style={{ display: 'flex', gap: 20, padding: '10px 20px', borderTop: '1px solid var(--color-divider)', fontSize: 12.5, color: 'var(--color-neutral-700)', background: 'var(--color-surface)' }}>
          <span><b>↑↓</b> move</span><span><b>↵</b> open</span><span><b>tab</b> scope</span><span><b>@</b> people</span><span><b>#</b> boards</span><span><b>lib:</b> library</span>
          <span style={{ marginLeft: 'auto' }}>Matches are ranked by closeness, like fzf</span>
        </div>
      </div>
    </div>
  );
}
