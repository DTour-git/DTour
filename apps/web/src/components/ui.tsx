import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { flair, initials, type PersonLite, type SocietyLite, type Tint, type Tone } from '@dtour/shared';
import { Icon } from './Icon';

/** Two overlapping speech bubbles (cyan + magenta, multiply) — the DTour mark. */
export function LogoMark({ size = 34 }: { size?: number }) {
  const off = Math.round(size * 0.118);
  const bubble = (bg: string, x: number, y: number): CSSProperties => ({
    position: 'absolute', left: x, top: y, width: size, height: size,
    borderRadius: '50% 50% 50% 0', background: bg, mixBlendMode: 'multiply',
  });
  return (
    <div style={{ position: 'relative', width: size + off + 2, height: size + off + 1, flex: 'none' }} aria-hidden>
      <span style={bubble('var(--color-accent)', 0, 0)} />
      <span style={bubble('var(--color-accent-2)', off, Math.round(off * 0.75))} />
    </div>
  );
}

export const TINT_CSS: Record<string, { bg: string; fg: string }> = {
  accent: { bg: 'var(--color-accent-200)', fg: 'var(--color-accent-800)' },
  accent2: { bg: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)' },
  neutral: { bg: 'var(--color-neutral-200)', fg: 'var(--color-text)' },
  'accent-light': { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)' },
};
const SOC_TINT: Record<string, { bg: string; fg: string }> = {
  accent: { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)' },
  accent2: { bg: 'var(--color-accent-2-100)', fg: 'var(--color-accent-2-800)' },
  neutral: { bg: 'var(--color-neutral-200)', fg: 'var(--color-text)' },
};

export function Avatar({ person, society, size = 36, ring, label }: {
  person?: { handle: string; tint: string } | null; society?: SocietyLite | null; size?: number; ring?: string; label?: string;
}) {
  const base: CSSProperties = {
    width: size, height: size, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: Math.round(size * 0.36), fontFamily: 'var(--font-body)',
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
  };
  if (society) {
    const t = SOC_TINT[society.tint] ?? SOC_TINT.accent;
    return <span style={{ ...base, background: t.bg, color: t.fg }}><Icon name={society.icon} size={Math.round(size * 0.5)} /></span>;
  }
  const t = TINT_CSS[(person?.tint as Tint) ?? 'neutral'] ?? TINT_CSS.neutral;
  return <span style={{ ...base, background: t.bg, color: t.fg }}>{label ?? initials(person?.handle ?? '?')}</span>;
}

export function Tag({ tone = 'neutral', children, style }: { tone?: 'accent' | 'accent2' | 'neutral' | 'outline'; children: ReactNode; style?: CSSProperties }) {
  const cls = { accent: 'tag-accent', accent2: 'tag-accent-2', neutral: 'tag-neutral', outline: 'tag-outline' }[tone];
  return <span className={`tag ${cls}`} style={style}>{children}</span>;
}

export function FlairTag({ person }: { person: Pick<PersonLite, 'branch_code' | 'grad_year'> }) {
  const f = flair(person.branch_code, person.grad_year);
  return f ? <Tag>{f}</Tag> : null;
}

export function Seal({ size = 15 }: { size?: number }) {
  return <Icon name="seal-check" size={size} color="var(--color-accent)" style={{ verticalAlign: -2 }} />;
}

/** Misregistered C/M/Y plate numeral (.cmyk-num). */
export function CmykNum({ children, size, tracking = '-.04em', style }: { children: ReactNode; size: number; tracking?: string; style?: CSSProperties }) {
  return (
    <div className="cmyk-num" style={{ font: `600 ${size}px/0.9 var(--font-heading)`, letterSpacing: tracking, ...style }}>
      <span className="paper">{children}</span>
      <span className="plate plate-c" aria-hidden>{children}</span>
      <span className="plate plate-m" aria-hidden>{children}</span>
      <span className="plate plate-y" aria-hidden>{children}</span>
    </div>
  );
}

/** Striped halftone placeholder (or a real image) with the 3px dot screen. */
export function Halftone({ height, label, src, style }: { height: number; label?: string | null; src?: string | null; style?: CSSProperties }) {
  return (
    <div className="halftone" style={{ height, display: 'flex', alignItems: 'flex-end', padding: src ? 0 : label ? 14 : 0, ...style }}>
      {src ? <img src={src} alt={label ?? ''} /> : label ? <span className="placeholder-label">{label}</span> : null}
    </div>
  );
}

export const TONE_CSS: Record<Tone, { main: string; tint: string; strong: string; heading: string; tileFg: string }> = {
  accent: { main: 'var(--color-accent)', tint: 'var(--color-accent-100)', strong: 'var(--color-accent-700)', heading: 'var(--color-accent-800)', tileFg: 'var(--color-accent-700)' },
  accent2: { main: 'var(--color-accent-2)', tint: 'var(--color-accent-2-100)', strong: 'var(--color-accent-2-700)', heading: 'var(--color-accent-2-800)', tileFg: 'var(--color-accent-2-700)' },
  ink: { main: 'var(--color-text)', tint: 'var(--color-surface)', strong: 'var(--color-text)', heading: 'var(--color-text)', tileFg: 'var(--color-text)' },
};

export function Kicker({ children, color = 'var(--color-accent-2-700)', style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <div className="kicker" style={{ color, ...style }}>{children}</div>;
}

export function H6({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <h6 style={{ margin: '0 0 12px', color: 'var(--color-neutral-700)', ...style }}>{children}</h6>;
}

/** "@handle" or a society name with its seal. */
export function AuthorName({ author, society, asHandle }: { author: PersonLite; society?: SocietyLite | null; asHandle?: boolean }) {
  if (society && !asHandle) {
    return <><b style={{ color: 'var(--color-text)' }}>{society.name}</b>{society.verified && <Seal size={16} />}</>;
  }
  return <Link href={`/u/${author.handle}`} style={{ color: 'var(--color-text)', fontWeight: 600 }}>@{author.handle}</Link>;
}

export function SectionRule({ num, title, tone, sub, right, numSize = 34 }: { num: string; title: string; tone: Tone; sub?: string; right?: ReactNode; numSize?: number }) {
  const t = TONE_CSS[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, borderBottom: `3px solid ${t.main}`, paddingBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ font: `600 ${numSize}px/0.9 var(--font-heading)`, color: t.strong }}>{num}</span>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {sub && <span style={{ fontSize: 14, color: 'var(--color-neutral-700)', paddingBottom: 2 }}>{sub}</span>}
      {right && <span style={{ marginLeft: 'auto', paddingBottom: 2 }}>{right}</span>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '24px 0', fontSize: 15, color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>{children}</div>;
}

export function pad2(n: number) { return String(n).padStart(2, '0'); }
