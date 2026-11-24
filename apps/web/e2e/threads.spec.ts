import { expect, test, type Page } from '@playwright/test';
import { adminInsert, cleanup, signIn } from './helpers';

// #10: the thread lifecycle: create, edit, delete, vote, save, accept an answer.
// Everything these tests create starts with the marker and is removed in afterAll.
const stamp = Date.now();
const prefix = `e2e flow ${stamp}`;
const CAMPUS_BUZZ = '00000000-0000-4000-8000-000000000201';
const STUDENT = '00000000-0000-4000-8000-00000000e2e1';
const MODERATOR = '00000000-0000-4000-8000-00000000e2e2';

test.afterAll(async () => {
  await cleanup('threads', `title=like.${encodeURIComponent('e2e flow %')}`);
});

/** Opens a thread from its board page, the way a student would find it. */
async function openFromBoard(page: Page, title: string) {
  await page.goto('/b/campus-buzz?tab=new');
  await page.getByRole('link', { name: title }).first().click();
  await expect(page).toHaveURL(/\/b\/campus-buzz\/\d+$/);
  return Number(new URL(page.url()).pathname.split('/').pop());
}

for (const [type, label] of [
  ['thread', 'thread'],
  ['question', 'question'],
] as const) {
  test(`a student can create, edit and delete a ${label}`, async ({ page }) => {
    const title = `${prefix} ${label}`;
    await signIn(page, 'e2e.student', `/new?type=${type}&board=campus-buzz`);
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByPlaceholder('Add context. What have you tried? Which branch, semester, professor?').fill(`Body of the ${label}.`);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page).toHaveURL(/\/b\/campus-buzz\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    // It is listed on its board.
    await page.goto('/b/campus-buzz?tab=new');
    await expect(page.getByRole('link', { name: title }).first()).toBeVisible();
    await page.getByRole('link', { name: title }).first().click();

    // Edit the title.
    await page.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit thread' });
    await dialog.getByLabel('Title').fill(`${title} edited`);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { level: 1, name: `${title} edited` })).toBeVisible();

    // Delete it: it returns to the board and the post is gone.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/b\/campus-buzz$/);
    await page.goto('/b/campus-buzz?tab=new');
    await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  });
}

test('a student can vote on, save and accept an answer on a thread', async ({ page }) => {
  const title = `${prefix} votes`;
  await adminInsert('threads', { board_id: CAMPUS_BUZZ, author_id: STUDENT, kind: 'question', title, body: 'Votes, saves and answers.' });
  await signIn(page, 'e2e.student');
  const threadId = await openFromBoard(page, title);
  await adminInsert('replies', { thread_id: threadId, author_id: MODERATOR, body: `${prefix} an answer` });
  await page.reload();
  await expect(page.getByText(`${prefix} an answer`)).toBeVisible();

  // Thread vote: up, then back to zero.
  const up = page.getByRole('button', { name: 'Upvote' });
  const score = up.locator('xpath=following-sibling::span[1]');
  await expect(score).toHaveText('0');
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'true');
  await expect(score).toHaveText('1');
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'false');
  await expect(score).toHaveText('0');

  // Reply vote: the only button named by a bare number is the reply's.
  const replyVote = page.getByRole('button', { name: /^\d+$/ });
  await expect(replyVote).toHaveText('0');
  await replyVote.click();
  await expect(replyVote).toHaveAttribute('aria-pressed', 'true');
  await expect(replyVote).toHaveText('1');

  // Save, then find it on the profile.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unsave' })).toBeVisible();
  await page.goto('/u/e2e.student?tab=saved');
  await expect(page.getByRole('link', { name: title }).first()).toBeVisible();

  // The author accepts the answer.
  await page.getByRole('link', { name: title }).first().click();
  await page.getByRole('button', { name: 'Accept answer' }).click();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unaccept' })).toBeVisible();
});
