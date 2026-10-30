import { expect, test } from '@playwright/test';

// Reading is public; anything that writes sends visitors to sign in.
test.describe('visitor', () => {
  test('Today shows the lead story, timeline and boards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Today at DTU')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'From the boards' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('Boards and a thread are readable without an account', async ({ page }) => {
    await page.goto('/boards');
    await expect(page.getByRole('heading', { name: 'The Boards' })).toBeVisible();
    await page.goto('/t/1');
    await expect(page).toHaveURL(/\/b\/coe-sem-3\/1$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('DSA end-sem');
  });

  test('upvoting a thread as a visitor asks you to sign in', async ({ page }) => {
    await page.goto('/b/coe-sem-3/1');
    await page.getByRole('button', { name: 'Upvote', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('upvoting a reply as a visitor asks you to sign in', async ({ page }) => {
    await page.goto('/b/coe-sem-3/1');
    await page.locator('#reply-1').getByRole('button', { name: 'Upvote reply' }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('posting is members-only', async ({ page }) => {
    await page.goto('/new');
    await expect(page).toHaveURL(/\/login\?next=%2Fnew/);
    await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible();
  });

  test('search palette opens with / and ranks matches', async ({ page }) => {
    await page.goto('/boards');
    const dialog = page.getByRole('dialog', { name: 'Search' });
    // The `/` listener attaches on hydration, which can land after `goto` resolves: retry the key until it's heard.
    await expect(async () => {
      await page.keyboard.press('/');
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await dialog.getByLabel('Search query').fill('dsa pyq');
    await expect(dialog.getByText(/DSA end-sem/).first()).toBeVisible();
  });
});
