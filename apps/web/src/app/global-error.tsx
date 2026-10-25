'use client';

// Last-resort error screen when even the root layout fails.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f2f2', color: '#201e1d', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 36, margin: '0 0 10px' }}>DTour hit a snag.</h1>
          <p style={{ margin: '0 0 20px' }}>Please try again.</p>
          <button onClick={reset} style={{ padding: '10px 18px', background: '#0088b0', color: '#fff', border: 0, borderRadius: 2, cursor: 'pointer', fontSize: 15 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
