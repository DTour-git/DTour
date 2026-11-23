/** Public address of the site (share links, sitemap). Set NEXT_PUBLIC_SITE_URL on the host. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** Metadata for a page that must not be indexed (demo content, content awaiting review). */
export const NOINDEX = { robots: { index: false, follow: false } } as const;
