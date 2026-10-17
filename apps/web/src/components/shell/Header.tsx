'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dateline, longDate, type ConfigRow } from '@dtour/shared';
import { Icon } from '../Icon';
import { Avatar, LogoMark } from '../ui';
import { OnlineCount, useShell } from './Shell';
import { NotificationBell } from './NotificationBell';

const NAV = [
  { href: '/', label: 'Today', match: (p: string) => p === '/' },
  { href: '/boards', label: 'Boards', match: (p: string) => p.startsWith('/boards') || p.startsWith('/b/') || p.startsWith('/t/') },
  { href: '/wiki', label: 'Articles', match: (p: string) => p.startsWith('/wiki') },
  { href: '/library', label: 'Library', match: (p: string) => p.startsWith('/library') },
  { href: '/societies', label: 'Societies', match: (p: string) => p.startsWith('/societies') },
  { href: '/teams', label: 'Team Up', match: (p: string) => p.startsWith('/teams') },
  { href: '/kahan-chalein', label: 'Kahan chalein?', match: (p: string) => p.startsWith('/kahan-chalein') },
];

export function Header({ config, exam, modQueue }: {
  config: ConfigRow | null; modQueue: number | null;
  exam: { label: string; days: number; semester: number | null } | null;
}) {
  const path = usePathname();
  const { me, openSearch } = useShell();
  const home = path === '/';
  const dl = config ? dateline(config.launch_date) : null;

  return (
    <header>
      {home && (
        <div className="dateline">
          {dl && <span>Vol. {dl.vol} · No. {dl.no}</span>}
          <span>{longDate()}</span>
          <span>{config?.location ?? 'Bawana Road, Delhi'}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="users-three" size={16} color="var(--color-accent)" /><OnlineCount /> in the Lounge
          </span>
        </div>
      )}
      <div className="brand-row">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--color-text)' }} aria-label="DTour home">
          <LogoMark />
          <span style={{ font: '600 48px/0.9 var(--font-heading)', letterSpacing: '-.035em' }}>DTour</span>
        </Link>
        <span className="tagline" style={{ font: 'italic 400 18px/1.3 var(--font-body)', color: 'var(--color-neutral-700)' }}>The campus, all in one place.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="search-trigger" onClick={() => openSearch()} aria-label="Search anything">
            <Icon name="magnifying-glass" size={18} />
            <span className="st-text">Search anything</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}><span className="keyhint">/</span></span>
          </button>
          <Link href={me ? '/new' : '/login?next=/new'} className="btn btn-primary" style={{ height: 40, color: 'var(--color-bg)' }}>
            <Icon name="pencil-simple-line" size={17} />Post
          </Link>
          {modQueue != null && (
            <Link href="/mod" title="Moderation queue" aria-label={`Moderation queue, ${modQueue} waiting`} style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
              <Icon name="shield-check" size={24} />
              {modQueue > 0 && <span style={{ position: 'absolute', top: 4, right: 2, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: 'var(--color-accent)', color: 'var(--color-bg)', font: '600 10.5px/17px var(--font-body)', textAlign: 'center' }}>{modQueue}</span>}
            </Link>
          )}
          {me ? (
            <>
              <NotificationBell />
              <Link href={`/u/${me.handle}`} aria-label="Your profile"><Avatar person={me} size={36} /></Link>
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn btn-secondary" style={{ height: 40, color: 'var(--color-text)' }}>Sign in</Link>
          )}
        </div>
      </div>
      <nav className="nav section-nav" aria-label="Sections">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? 'page' : undefined}>{n.label}</Link>
        ))}
        {exam && (
          <span className="countdown" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-neutral-800)' }}>
            <Icon name="hourglass-medium" size={18} color="var(--color-accent-2)" />
            {exam.label} in <b style={{ color: 'var(--color-accent-2-700)' }}>{exam.days} {exam.days === 1 ? 'day' : 'days'}</b>
            <span style={{ color: 'var(--color-neutral-500)' }}>·</span>
            <Link href="/library" style={{ fontWeight: 600 }}>{exam.semester ? `Your sem ${exam.semester} notes →` : 'Your notes →'}</Link>
          </span>
        )}
      </nav>
    </header>
  );
}
