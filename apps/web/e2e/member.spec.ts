import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

const marker = `e2e reply ${Date.now()}`;
const revisionMarker = `e2e wiki image ${Date.now()}`;

test.afterAll(async () => {
  await cleanup('replies', `body=like.${encodeURIComponent('e2e reply %')}`);
  await cleanup('wiki_revisions', `summary=eq.${encodeURIComponent(revisionMarker)}`);
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

  test('the moderation preview omits images from a suggested edit', async ({ page }) => {
    const imageUrl = 'https://example.invalid/wiki-preview.png';
    await page.route(imageUrl, (route) => route.abort());
    await signIn(page, 'e2e.student');
    await page.goto('/wiki/how-to-get-a-9-cgpa-at-dtu?tab=edit');
    const editor = page.getByRole('article');
    await editor.locator('textarea').fill(`### Preview text\n\n![Test image](${imageUrl})`);
    await editor.getByPlaceholder(/What did you change/).fill(revisionMarker);
    await editor.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page).toHaveURL(/\/wiki\/how-to-get-a-9-cgpa-at-dtu$/);

    await page.context().clearCookies();
    await signIn(page, 'e2e.moderator');
    await page.goto('/mod');
    const revision = page.locator('.row-rule').filter({ hasText: revisionMarker });
    await revision.getByRole('button', { name: 'Compare versions' }).click();
    await expect(revision.getByRole('heading', { name: 'Preview text' })).toBeVisible();
    await expect(revision.locator('img')).toHaveCount(0);
  });

  test('the composer previews inline, display and invalid maths', async ({ page }) => {
    await signIn(page, 'e2e.student');
    await page.goto('/new');
    await page.getByPlaceholder('Add context. What have you tried? Which branch, semester, professor?').fill('Inline $x^2$ and $\\notacommand$.\n\n$$\nx=1\n$$');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('.markdown .katex')).toHaveCount(2);
    await expect(page.locator('.markdown .katex-display')).toHaveCount(1);
    await expect(page.locator('.markdown code')).toHaveText('$\\notacommand$');
  });
});
