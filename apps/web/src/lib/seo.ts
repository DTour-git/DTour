/** Public address of the site (share links, sitemap). Set NEXT_PUBLIC_SITE_URL where the site is built and hosted. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** Site-wide Open Graph values. A page that sets its own `openGraph` replaces the whole object, so it repeats these. */
export const OPEN_GRAPH = { siteName: 'DTour', type: 'website' } as const;

/** Metadata for a page that must not be indexed (demo content, content awaiting review). */
export const NOINDEX = { robots: { index: false, follow: false } } as const;

/** Preview text from markdown: no images, link targets or markup characters, one line, at most `max` characters. Undefined when empty. */
export function preview(md: string, max = 160): string | undefined {
  const s = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
