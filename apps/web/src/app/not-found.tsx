import Link from 'next/link';

// Fallback for URLs outside the main site (the main layout has its own 404).
export default function RootNotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 40, margin: '0 0 10px' }}>Page not found</h1>
        <Link href="/" className="btn btn-primary" style={{ color: 'var(--color-bg)' }}>Back to DTour</Link>
      </div>
    </main>
  );
}
