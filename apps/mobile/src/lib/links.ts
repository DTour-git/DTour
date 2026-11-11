import type { Href } from 'expo-router';
import { linkTarget } from '@dtour/shared';
import { appRoute } from './routes';

export type AppLink = { kind: 'app'; route: Href } | { kind: 'browser'; url: string } | { kind: 'blocked' };

/** What a link from someone's post may do in the app: open a DTour screen, open a web page, or nothing. */
export function resolveLink(href: string | null | undefined): AppLink {
  const t = linkTarget(href);
  if (t.kind === 'internal') return { kind: 'app', route: appRoute(t.path) };
  if (t.kind === 'external') return { kind: 'browser', url: t.url };
  return { kind: 'blocked' };
}

/** Opens a user-written link through `resolveLink`. Returns false (and opens nothing) when it is blocked. */
export function openUserLink(href: string | null | undefined, io: { push: (route: Href) => void; openURL: (url: string) => unknown }): boolean {
  const l = resolveLink(href);
  if (l.kind === 'app') io.push(l.route);
  else if (l.kind === 'browser') void Promise.resolve(io.openURL(l.url)).catch(() => {});
  return l.kind !== 'blocked';
}
