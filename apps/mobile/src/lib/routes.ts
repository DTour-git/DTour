import type { Href } from 'expo-router';

/** Map the web routes stored in the DB (search, activity feed) to app routes. */
export function appRoute(web: string): Href {
  const m = (re: RegExp) => web.match(re);
  let r;
  if ((r = m(/^\/t\/(\d+)/)) || (r = m(/^\/b\/[^/]+\/(\d+)/))) return `/thread/${r[1]}` as Href;
  if ((r = m(/^\/b\/([^/?]+)/))) return `/board/${r[1]}` as Href;
  if ((r = m(/^\/wiki\/([^/?]+)/))) return `/wiki/${r[1]}` as Href;
  if ((r = m(/^\/library\/subject\/([^/?]+)/))) return `/library/${r[1]}` as Href;
  if ((r = m(/^\/u\/([^/?]+)/))) return `/u/${r[1]}` as Href;
  if ((r = m(/^\/lounge(?:\?room=([^&]+))?/))) return (r[1] ? `/lounge?room=${r[1]}` : '/lounge') as Href;
  if (web.startsWith('/kahan')) return '/kahan' as Href;
  if (web.startsWith('/teams')) return '/teams' as Href;
  if (web.startsWith('/societies')) return '/societies' as Href;
  if (web.startsWith('/library')) return '/library' as Href;
  if (web.startsWith('/wiki')) return '/wiki' as Href;
  if (web.startsWith('/boards')) return '/boards' as Href;
  if (web.startsWith('/mod')) return '/mod' as Href;
  return '/' as Href;
}
