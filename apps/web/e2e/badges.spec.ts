import { expect, test } from '@playwright/test';
import { adminInsert, cleanup, signIn } from './helpers';

// #63: badges are awarded by the database. A moderator approves e2e.student's
// guide, and the student gets the "Wiki author" badge: in the bell and on their
// profile. The guide starts with the `e2e-badge-` slug and is removed in afterAll.
const stamp = Date.now();
const slug = `e2e-badge-${stamp}`;
const title = `e2e badge ${stamp} guide`;
const STUDENT = '00000000-0000-4000-8000-00000000e2e1';
const clearBadge = async () => {
  await cleanup('badges', `user_id=eq.${STUDENT}&kind=eq.wiki_author`);
  await cleanup('notifications', `user_id=eq.${STUDENT}&kind=eq.badge`);
};

test.beforeAll(clearBadge);
test.afterAll(async () => {
  await cleanup('wiki_articles', `slug=like.${encodeURIComponent('e2e-badge-%')}`);
  await clearBadge();
});

test('an approved guide earns its author the Wiki author badge', async ({ page }) => {
  await adminInsert('wiki_articles', { slug, title, body: '### Heading\n\nText.', started_by: STUDENT, status: 'pending' });

  await signIn(page, 'e2e.moderator', '/mod');
  const guide = page.locator('.row-rule').filter({ hasText: title });
  await guide.getByRole('button', { name: 'Approve' }).click();
  await expect(guide).toHaveCount(0);

  await page.context().clearCookies();
  await signIn(page, 'e2e.student', '/u/e2e.student');
  await expect(page.getByRole('heading', { name: 'Badges' })).toBeVisible();
  await expect(page.getByText('Wiki author', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifications' }).getByText('You earned the “Wiki author” badge')).toBeVisible();
});
