import { expect, test } from '@playwright/test';
import { adminInsert, cleanup, signIn } from './helpers';

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

  test('a signed-in student sees their reply vote after reload', async ({ page }) => {
    // Signed-in thread pages run an extra query (the member's reply votes); this covers it end to end.
    const voteMarker = `e2e reply vote ${Date.now()}`;
    await adminInsert('replies', { thread_id: 3, author_id: '00000000-0000-4000-8000-00000000e2e1', body: voteMarker });
    await signIn(page, 'e2e.student');
    await page.goto('/b/campus-buzz/3');

    const reply = page.getByText(voteMarker, { exact: true }).locator('xpath=ancestor::div[.//button[@aria-pressed]][1]');
    const vote = reply.locator('button[aria-pressed]').first();
    await expect(vote).toHaveAttribute('aria-pressed', 'false');
    await expect(vote).toHaveText('0');
    await vote.click();
    await expect(vote).toHaveAttribute('aria-pressed', 'true');
    await expect(vote).toHaveText('1');

    await page.reload();
    await expect(vote).toHaveAttribute('aria-pressed', 'true');
    await expect(vote).toHaveText('1');
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
    await page
      .getByPlaceholder('Add context. What have you tried? Which branch, semester, professor?')
      .fill('Inline $x^2$ and $\\notacommand$.\n\n$$\nx=1\n$$');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('.markdown .katex')).toHaveCount(2);
    await expect(page.locator('.markdown .katex-display')).toHaveCount(1);
    await expect(page.locator('.markdown code')).toHaveText('$\\notacommand$');
  });
});
