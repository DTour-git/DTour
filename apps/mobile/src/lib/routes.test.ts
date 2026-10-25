import { describe, expect, it } from 'vitest';
import { appRoute } from './routes';

// The database stores website routes (search, activity, notifications); the app must map every one.
describe('appRoute', () => {
  it.each([
    ['/t/12', '/thread/12'],
    ['/b/coe-sem-3/12', '/thread/12'],
    ['/b/academics', '/board/academics'],
    ['/wiki/how-to-get-a-9-cgpa-at-dtu', '/wiki/how-to-get-a-9-cgpa-at-dtu'],
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
    ['/somewhere-unknown', '/'],
  ])('%s → %s', (web, app) => {
    expect(appRoute(web)).toBe(app);
  });
});
