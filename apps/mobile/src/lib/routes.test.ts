import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appRoute } from './routes';

// The database stores website routes (search, activity, notifications); the app must map every one.
describe('appRoute', () => {
  it.each([
    ['/t/12', '/thread/12'],
    ['/b/coe-sem-3/12', '/thread/12'],
    ['/b/academics', '/board/academics'],
    ['/wiki/how-to-get-a-9-cgpa-at-dtu', '/wiki/how-to-get-a-9-cgpa-at-dtu'],
    ['/wiki/how-to-get-a-9-cgpa-at-dtu?tab=talk', '/wiki/how-to-get-a-9-cgpa-at-dtu'],
    ['/library/subject/CO201', '/library/CO201'],
    ['/u/aarav.k', '/u/aarav.k'],
    ['/lounge?room=global', '/lounge?room=global'],
    ['/lounge', '/lounge'],
    ['/kahan-chalein', '/kahan'],
    ['/teams', '/teams'],
    ['/societies', '/societies'],
    ['/library/COE/3', '/library'],
    ['/wiki', '/wiki'],
    ['/boards', '/boards'],
    ['/mod', '/mod'],
    ['/new', '/new'],
    ['/somewhere-unknown', '/'],
  ])('%s → %s', (web, app) => {
    expect(appRoute(web)).toBe(app);
  });
});

// Every route a notification row can carry (the notify() calls in supabase/migrations), and the
// phone push tap uses appRoute() on it. Each must land on a real screen, not the home fallback.
describe('notification routes', () => {
  const screens = (dir: string, prefix = ''): RegExp[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) return screens(join(dir, e.name), /^\(.*\)$/.test(e.name) ? prefix : `${prefix}/${e.name}`);
      const name = e.name.replace(/\.tsx$/, '');
      if (name === '_layout' || name === e.name) return [];
      const seg = name === 'index' ? '' : `/${name}`;
      return [new RegExp(`^${(prefix + seg).replace(/\[[^\]]+\]/g, '[^/]+') || '/'}$`)];
    });
  const real = screens(join(__dirname, '../app'));

  it.each([
    ['reply / comment / mention / upvote / accepted', '/t/12', '/thread/12'],
    ['thread mention in a board URL', '/b/academics/12', '/thread/12'],
    ['lounge mention', '/lounge?room=placements', '/lounge?room=placements'],
    ['team request (sent and reviewed)', '/teams', '/teams'],
    ['wiki review (guide or edit)', '/wiki/how-to-get-a-9-cgpa-at-dtu', '/wiki/how-to-get-a-9-cgpa-at-dtu'],
    ['badge earned', '/u/aarav.k', '/u/aarav.k'],
    ['event reminder', '/societies', '/societies'],
  ])('%s: %s', (_kind, web, app) => {
    const href = appRoute(web) as string;
    expect(href).toBe(app);
    expect(real.some((re) => re.test(href.split('?')[0]))).toBe(true);
  });
});
