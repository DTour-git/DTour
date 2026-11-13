import { describe, expect, it } from 'vitest';
import { mediaImageUrl } from './media';

const PROJECT = 'https://megohwzcghnbfdzsaypz.supabase.co';
const UID = '00000000-0000-4000-8000-00000000e2e1';
const upload = `${PROJECT}/storage/v1/object/public/media/${UID}/1731400000000-k3j9x2.jpg`;

describe('mediaImageUrl', () => {
  it('shows a photo uploaded to this project', () => {
    expect(mediaImageUrl(upload, PROJECT)).toBe(upload);
    expect(mediaImageUrl(upload, `${PROJECT}/`)).toBe(upload);
    expect(mediaImageUrl(upload, ' HTTPS://MEGOHWZCGHNBFDZSAYPZ.SUPABASE.CO ')).toBe(upload);
  });

  it('shows uploads on a local Supabase stack', () => {
    const local = `http://127.0.0.1:54321/storage/v1/object/public/media/${UID}/a.png`;
    expect(mediaImageUrl(local, 'http://127.0.0.1:54321')).toBe(local);
  });

  it.each([
    ['a third-party host', `https://tracker.example/pixel.png?user=${UID}`],
    ['another Supabase project', `https://cqdqfmejbwvumbbclkfk.supabase.co/storage/v1/object/public/media/${UID}/a.png`],
    ['a look-alike host', `${PROJECT}.evil.example/storage/v1/object/public/media/${UID}/a.png`],
    ['credentials in the authority', `https://megohwzcghnbfdzsaypz.supabase.co@evil.example/storage/v1/object/public/media/${UID}/a.png`],
    ['another bucket', `${PROJECT}/storage/v1/object/public/library/${UID}/a.png`],
    ['a signed or transformed URL', `${PROJECT}/storage/v1/render/image/public/media/${UID}/a.png`],
    ['a query string', `${upload}?width=1`],
    ['a fragment', `${upload}#x`],
    ['path traversal', `${PROJECT}/storage/v1/object/public/media/${UID}/../../../../evil.png`],
    ['a nested path', `${PROJECT}/storage/v1/object/public/media/${UID}/x/a.png`],
    ['a folder that is not a user id', `${PROJECT}/storage/v1/object/public/media/public/a.png`],
    ['a hidden file name', `${PROJECT}/storage/v1/object/public/media/${UID}/.a`],
    ['a data URI', 'data:image/png;base64,iVBORw0KGgo='],
    ['a javascript URI', 'javascript:alert(1)'],
    ['a relative path', `/storage/v1/object/public/media/${UID}/a.png`],
    ['an empty string', ''],
  ])('refuses %s', (_, url) => {
    expect(mediaImageUrl(url, PROJECT)).toBeNull();
  });

  it('refuses everything when the project URL is missing or malformed', () => {
    expect(mediaImageUrl(upload, undefined)).toBeNull();
    expect(mediaImageUrl(upload, '')).toBeNull();
    expect(mediaImageUrl(upload, 'megohwzcghnbfdzsaypz.supabase.co')).toBeNull();
    expect(mediaImageUrl(upload, `${PROJECT}/rest/v1`)).toBeNull();
  });

  it('refuses missing values', () => {
    expect(mediaImageUrl(null, PROJECT)).toBeNull();
    expect(mediaImageUrl(undefined, PROJECT)).toBeNull();
  });
});
