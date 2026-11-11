// Decides what a link written by a user (markdown, society apply links) may do.
// Only web links and DTour's own pages are allowed: anything else (javascript:, intent:, tel:, sms:,
// upi:, file:, other apps' deep links, dtour:// itself) would hand the tap to another app or the OS.

export type LinkTarget =
  | { kind: 'internal'; path: string } // a DTour web route, e.g. /b/academics/12
  | { kind: 'external'; url: string } // an http(s) page to open in the browser
  | { kind: 'blocked' };

/** Hosts that serve the DTour website; links to them open inside the app. None is deployed yet. */
export const SITE_HOSTS: readonly string[] = [];

const BLOCKED: LinkTarget = { kind: 'blocked' };

export function linkTarget(href: string | null | undefined, siteHosts: readonly string[] = SITE_HOSTS): LinkTarget {
  if (typeof href !== 'string') return BLOCKED;
  // Browsers drop tabs and newlines anywhere in a URL and control characters or spaces at either end,
  // so `java\tscript:` or ` javascript:` must be judged as `javascript:`.
  const s = href.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  // Inner spaces and controls make it malformed; a backslash is read as `/` by browsers (`/\evil.com`).
  if (!s || /[\u0000- \u007f\\]/.test(s)) return BLOCKED;

  if (s.startsWith('/') && !s.startsWith('//')) return { kind: 'internal', path: s };

  // `//host/path` is protocol-relative: on the website it means https://host/path.
  const url = s.startsWith('//') ? `https:${s}` : s;
  const m = /^(https?):\/\/([^/?#]*)(.*)$/i.exec(url);
  if (!m) return BLOCKED;
  const [, , authority, rest] = m;
  // `https://dtu.ac.in@evil.example` shows one host and opens another.
  if (authority.includes('@')) return BLOCKED;
  const host = authority.replace(/:\d*$/, '').toLowerCase().replace(/\.$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host)) return BLOCKED;

  if (siteHosts.some((h) => h.toLowerCase() === host)) {
    const path = rest.startsWith('/') ? rest : `/${rest}`;
    // A path starting with // would become a host again when reused as a link.
    return path.startsWith('//') ? BLOCKED : { kind: 'internal', path };
  }
  return { kind: 'external', url };
}

/** The href a website link may use (a DTour path or an http(s) URL), or null if it must not be a link. */
export function safeHref(href: string | null | undefined, siteHosts: readonly string[] = SITE_HOSTS): string | null {
  const t = linkTarget(href, siteHosts);
  return t.kind === 'internal' ? t.path : t.kind === 'external' ? t.url : null;
}
