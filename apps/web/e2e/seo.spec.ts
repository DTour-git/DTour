import { expect, test } from '@playwright/test';
import { adminInsert, cleanup } from './helpers';

// #16: robots.txt, the sitemap and link-preview metadata.
const stamp = Date.now();
const published = `e2e-seo-published-${stamp}`;
const pending = `e2e-seo-pending-${stamp}`;
const threadTitle = `e2e seo thread ${stamp}`;

test.afterAll(async () => {
  await cleanup('wiki_articles', `slug=like.${encodeURIComponent('e2e-seo-%')}`);
  await cleanup('threads', `title=eq.${encodeURIComponent(threadTitle)}`);
});

test('robots.txt blocks private pages and points at the sitemap', async ({ request }) => {
  const text = await (await request.get('/robots.txt')).text();
  for (const path of ['/new', '/onboarding', '/mod', '/login', '/auth/']) expect(text).toContain(`Disallow: ${path}`);
  expect(text).toMatch(/Sitemap: \S+\/sitemap\.xml/);
});

test('the sitemap lists public content, not pending or demo content', async ({ request }) => {
  // The seed threads are all demo content, so a thread URL in the sitemap can only come from this one.
  const boards = await fetch(`${process.env.DEV_SUPABASE_URL}/rest/v1/boards?slug=eq.campus-buzz&select=id`, {
    headers: { apikey: process.env.DEV_SUPABASE_PUBLISHABLE_KEY! },
  });
  const [{ id: boardId }] = await boards.json();
  await adminInsert('threads', {
    board_id: boardId,
    author_id: '00000000-0000-4000-8000-00000000e2e1',
    title: threadTitle,
    is_demo: false,
  });
  await adminInsert('wiki_articles', [
    { slug: published, title: 'E2E SEO published', status: 'published' },
    { slug: pending, title: 'E2E SEO pending', status: 'pending' },
  ]);
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain(`/wiki/${published}</loc>`);
  expect(xml).toContain('/library/subject/CO201</loc>');
  expect(xml).toContain('/b/coe-sem-3</loc>');
  expect(xml).toMatch(/\/b\/campus-buzz\/\d+<\/loc>/);
  expect(xml).not.toContain(pending);
  expect(xml).not.toContain('/b/coe-sem-3/1</loc>'); // demo thread
});

test('a thread has a share card and demo content is not indexed', async ({ page, request }) => {
  await page.goto('/b/coe-sem-3/1');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  expect(await meta('meta[property="og:title"]')).toContain('DSA end-sem');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await meta('meta[name="robots"]')).toContain('noindex');

  // The image address is built from NEXT_PUBLIC_SITE_URL; request its path from the server under test.
  const image = new URL((await meta('meta[property="og:image"]'))!);
  const res = await request.get(image.pathname + image.search);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
