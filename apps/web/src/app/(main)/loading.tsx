// Shown while a page's data loads: a quiet skeleton in the page's shape.
export default function Loading() {
  const bar = (w: string, h: number, mt = 0) => (
    <div style={{ width: w, height: h, marginTop: mt, borderRadius: 2, background: 'var(--color-surface)' }} />
  );
  return (
    <div className="px loading-skeleton" style={{ paddingTop: 36 }} aria-busy="true" aria-label="Loading">
      {bar('180px', 12)}
      {bar('min(560px, 90%)', 40, 14)}
      {bar('min(420px, 70%)', 18, 14)}
      <div className="grid-2" style={{ gap: 20, marginTop: 40 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 120, borderRadius: 2, background: 'var(--color-surface)' }} />)}
      </div>
    </div>
  );
}
