import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

// #55: talk posts on a wiki guide can be deleted by their author and reported by others.
const GUIDE = '/wiki/how-to-get-a-9-cgpa-at-dtu?tab=talk';
const marker = `e2e talk ${Date.now()}`;

test.afterAll(async () => {
  await cleanup('wiki_talk', `body=like.${encodeURIComponent('e2e talk %')}`);
});

test('a student can post and delete their own talk post', async ({ page }) => {
  await signIn(page, 'e2e.student', GUIDE);
  await page.getByPlaceholder('Start a discussion about this guide…').fill(marker);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const post = page.locator('.row-rule', { hasText: marker });
  await expect(post).toBeVisible();
  await expect(post.getByRole('button', { name: 'Report' })).toHaveCount(0);

  page.once('dialog', (d) => d.accept());
  await post.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(marker)).toHaveCount(0);
});

test("someone else's talk post can be reported, not deleted", async ({ page }) => {
  await signIn(page, 'e2e.student', GUIDE);
  const other = page
    .locator('.row-rule')
    .filter({ hasNotText: 'e2e talk' })
    .filter({ has: page.getByRole('button', { name: 'Report' }) })
    .first();
  await expect(other).toBeVisible();
  await expect(other.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await other.getByRole('button', { name: 'Report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report this post' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
});
