import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

const marker = `e2e reply ${Date.now()}`;
// e2e.student's upvote on seeded reply 1 (thread 1), from the reply-vote test.
const studentReplyVote = 'user_id=eq.00000000-0000-4000-8000-00000000e2e1&reply_id=eq.1';

test.afterAll(async () => {
  await cleanup('replies', `body=like.${encodeURIComponent('e2e reply %')}`);
  await cleanup('reply_votes', studentReplyVote);
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

  test('a reply upvote is still shown after reloading the thread', async ({ page }) => {
    await cleanup('reply_votes', studentReplyVote);
    await signIn(page, 'e2e.student');
    await page.goto('/b/coe-sem-3/1');
    const upvote = page.locator('#reply-1').getByRole('button', { name: 'Upvote reply' });
    await expect(upvote).toHaveAttribute('aria-pressed', 'false');

    const saved = page.waitForResponse((r) => r.url().includes('/rpc/set_reply_vote') && r.ok());
    await upvote.click();
    await saved;
    // The server reads the vote back with getThread's signed-in reply_votes query.
    await page.reload();
    await expect(upvote).toHaveAttribute('aria-pressed', 'true');
  });

  test('the moderator sees the moderation queue', async ({ page }) => {
    await signIn(page, 'e2e.moderator');
    await page.goto('/mod');
    await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
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
