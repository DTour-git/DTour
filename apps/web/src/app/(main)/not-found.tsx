import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function NotFound() {
  return (
    <div className="px" style={{ paddingTop: 72, paddingBottom: 96, maxWidth: 680 }}>
      <div className="kicker" style={{ color: 'var(--color-accent-2-700)' }}>404 · Page not found</div>
      <h1 className="display" style={{ fontSize: 46, margin: '10px 0 12px', letterSpacing: '-.025em' }}>This page went missing.</h1>
      <p style={{ font: 'italic 400 19px/1.45 var(--font-body)', color: 'var(--color-neutral-800)', margin: 0 }}>
        It may have been deleted, or the link has a typo. If it was someone’s profile, they may have changed their handle.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        <Link href="/" className="btn btn-primary" style={{ color: 'var(--color-bg)' }}><Icon name="sun-horizon" size={17} />Back to Today</Link>
        <Link href="/boards" className="btn btn-secondary" style={{ color: 'var(--color-text)' }}><Icon name="squares-four" size={17} />Browse the boards</Link>
      </div>
    </div>
  );
}
