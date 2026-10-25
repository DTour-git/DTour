import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

const marker = `e2e reply ${Date.now()}`;

test.afterAll(async () => {
  await cleanup('replies', `body=like.${encodeURIComponent('e2e reply %')}`);
});

test.describe('member', () => {
  test('a signed-in student can reply to a thread', async ({ page }) => {
    await signIn(page, 'e2e.student');
    await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible();

    await page.goto('/b/campus-buzz/3');
    await page.getByRole('button', { name: /Add a reply/ }).click();
    await page.getByPlaceholder('Add a reply…').fill(marker);
    await page.getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(page.getByText(marker)).toBeVisible();
  });

  test('the moderator sees the moderation queue', async ({ page }) => {
    await signIn(page, 'e2e.moderator');
    await page.goto('/mod');
    await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  });
});
