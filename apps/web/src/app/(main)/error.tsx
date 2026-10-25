'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="px" style={{ paddingTop: 72, paddingBottom: 96, maxWidth: 680 }}>
      <div className="kicker" style={{ color: 'var(--color-accent-2-700)' }}>Something went wrong</div>
      <h1 className="display" style={{ fontSize: 46, margin: '10px 0 12px', letterSpacing: '-.025em' }}>We couldn’t load this page.</h1>
      <p style={{ font: 'italic 400 19px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', margin: 0 }}>
        It’s probably a hiccup with the connection. Try again in a moment.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={reset}><Icon name="clock-counter-clockwise" size={17} />Try again</button>
        <Link href="/" className="btn btn-secondary" style={{ color: 'var(--color-text)' }}>Back to Today</Link>
      </div>
      {error.digest && <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 20 }}>Error code: {error.digest}</div>}
    </div>
  );
}
