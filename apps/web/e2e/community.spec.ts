import { expect, test, type Page } from '@playwright/test';
import { adminInsert, cleanup, signIn } from './helpers';

// #10: the community flows that involve a second account: wiki review, reports,
// Team Up, society RSVPs, the Lounge and the notification bell. The student is
// e2e.student and the moderator e2e.moderator. Everything created here starts
// with the marker (or the `e2e-flow-` slug) and is removed in afterAll.
const stamp = Date.now();
const prefix = `e2e flow ${stamp}`;
const CAMPUS_BUZZ = '00000000-0000-4000-8000-000000000201';
const STUDENT = '00000000-0000-4000-8000-00000000e2e1';
const MODERATOR = '00000000-0000-4000-8000-00000000e2e2';
const OAT_SOCIETY = '00000000-0000-4000-8000-000000000102'; // owner of seed society post 1
const like = (p: string) => `=like.${encodeURIComponent(p)}`;

test.afterAll(async () => {
  await cleanup('wiki_articles', `slug${like('e2e-flow-%')}`);
  await cleanup('replies', `body${like('e2e flow %')}`);
  await cleanup('threads', `title${like('e2e flow %')}`);
  await cleanup('teams', `title${like('e2e flow %')}`);
  await cleanup('society_posts', `title${like('e2e flow %')}`);
  await cleanup('lounge_messages', `body${like('e2e flow %')}`);
  // Triggers also wrote activity rows (replies, wiki edits) that would now link to nothing.
  await cleanup('activities', `title${like('%e2e flow %')}`);
});

/** Switches accounts in the same browser. */
async function switchTo(page: Page, handle: string) {
  await page.context().clearCookies();
  await signIn(page, handle);
}

test('a wiki edit suggested by a student goes live when a moderator approves it', async ({ page }) => {
  const slug = `e2e-flow-${stamp}`;
  const summary = `${prefix} wiki edit`;
  await adminInsert('wiki_articles', {
    slug,
    title: `${prefix} guide`,
    body: '### Original heading\n\nOriginal text.',
    started_by: MODERATOR,
    status: 'published',
  });

  await signIn(page, 'e2e.student', `/wiki/${slug}?tab=edit`);
  const editor = page.getByRole('article');
  await editor.locator('textarea').fill('### Approved heading\n\nEdited text.');
  await editor.getByPlaceholder(/What did you change/).fill(summary);
  await editor.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page).toHaveURL(new RegExp(`/wiki/${slug}$`));
  await expect(page.getByRole('heading', { name: 'Original heading' })).toBeVisible();

  await switchTo(page, 'e2e.moderator');
  await page.goto('/mod');
  const revision = page.locator('.row-rule').filter({ hasText: summary });
  await revision.getByRole('button', { name: 'Approve' }).click();
  await expect(revision).toHaveCount(0);

  await page.goto(`/wiki/${slug}`);
  await expect(page.getByRole('heading', { name: 'Approved heading' })).toBeVisible();
});

test('a reported reply shows up in the moderation queue and the moderator can remove it', async ({ page }) => {
  const body = `${prefix} reported reply`;
  await adminInsert('replies', { thread_id: 3, author_id: MODERATOR, body });

  await signIn(page, 'e2e.student', '/b/campus-buzz/3');
  // The nearest block around the reply text that holds its Report button.
  const reply = page.getByRole('main').getByText(body).locator('xpath=ancestor::div[.//button[normalize-space()="Report"]][1]');
  await reply.getByRole('button', { name: 'Report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report this post' });
  await dialog.getByLabel('Spam or ads').check();
  await dialog.getByRole('button', { name: 'Report' }).click();
  await expect(dialog).toHaveCount(0);

  await switchTo(page, 'e2e.moderator');
  await page.goto('/mod');
  const report = page.locator('.row-rule').filter({ hasText: body });
  await expect(report.getByText('Spam or ads', { exact: true })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await report.getByRole('button', { name: /^Remove/ }).click();
  await expect(report).toHaveCount(0);

  await page.goto('/b/campus-buzz/3');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // the thread has rendered
  await expect(page.getByText(body)).toHaveCount(0);
});

test('a student asks to join two teams and the owner accepts one and declines the other', async ({ page }) => {
  const accepted = `${prefix} team accepted`;
  const declined = `${prefix} team declined`;
  const closes = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const team = { owner_id: MODERATOR, category: 'hackathon', event_name: 'E2E Hackathon', deadline_on: closes };
  await adminInsert('teams', [
    { ...team, title: accepted },
    { ...team, title: declined },
  ]);
  const card = (title: string) => page.locator('.card').filter({ hasText: title });

  await signIn(page, 'e2e.student', '/teams');
  for (const title of [accepted, declined]) {
    await card(title).getByRole('button', { name: 'Ask to join' }).click();
    await expect(card(title).getByRole('button', { name: /Requested/ })).toBeVisible();
  }

  await switchTo(page, 'e2e.moderator');
  await page.goto('/teams');
  await card(accepted).getByRole('button', { name: 'Accept' }).click();
  await expect(card(accepted).getByRole('button', { name: 'Accept' })).toHaveCount(0);
  await card(declined).getByRole('button', { name: 'Decline' }).click();
  await expect(card(declined).getByRole('button', { name: 'Decline' })).toHaveCount(0);

  await switchTo(page, 'e2e.student');
  await page.goto('/teams');
  await expect(card(accepted).getByText("You're in")).toBeVisible();
  await expect(card(declined).getByText('Request not accepted')).toBeVisible();
});

test('RSVPing to a society event toggles and the count follows', async ({ page }) => {
  const title = `${prefix} event`;
  await adminInsert('society_posts', {
    society_id: OAT_SOCIETY,
    kind: 'event',
    title,
    body: 'Open to all.',
    when_label: 'soon',
    rsvp_count: 0,
  });

  await signIn(page, 'e2e.student', '/societies');
  const post = page.getByRole('main').getByText(title, { exact: true }).locator('..');
  const rsvp = post.getByRole('button', { name: /RSVP|Going/ });
  await expect(post.getByText('0 going')).toBeVisible();

  // The button updates the page at once, so wait for the server call and reload to see what was stored.
  for (const [pressed, count] of [
    ['true', '1 going'],
    ['false', '0 going'],
  ]) {
    const done = page.waitForResponse((r) => r.url().includes('/rpc/toggle_rsvp') && r.ok());
    await rsvp.click();
    await done;
    await page.reload();
    await expect(rsvp).toHaveAttribute('aria-pressed', pressed);
    await expect(post.getByText(count)).toBeVisible();
  }
});

test('a student can send, edit and delete a Lounge message', async ({ page }) => {
  const text = `${prefix} lounge`;
  await signIn(page, 'e2e.student', '/lounge');
  const lounge = page.getByRole('complementary', { name: 'Lounge' });
  await lounge.getByLabel('Message', { exact: true }).fill(text);
  await lounge.getByRole('button', { name: 'Send' }).click();

  // A message that is still sending has no Edit button, so waiting for it waits for the save.
  const message = lounge.locator('.lounge-msg').filter({ hasText: text });
  await message.getByRole('button', { name: 'Edit' }).click();
  // While editing, the text lives in an input, so `message` no longer matches; use the drawer.
  await lounge.getByLabel('Edit message').fill(`${text} edited`);
  const edited = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/lounge_messages') && r.ok());
  await lounge.getByRole('button', { name: 'Save' }).click();
  await edited;
  await expect(lounge.getByText(`${text} edited`)).toBeVisible();

  // Reopen the Lounge to see what was stored.
  await page.goto('/lounge');
  await expect(lounge.getByText(`${text} edited`)).toBeVisible();

  const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('/lounge_messages') && r.ok());
  page.once('dialog', (d) => d.accept());
  await lounge
    .locator('.lounge-msg')
    .filter({ hasText: `${text} edited` })
    .getByRole('button', { name: 'Delete' })
    .click();
  await deleted;
  await page.goto('/lounge');
  await expect(lounge.getByLabel('Message', { exact: true })).toBeVisible(); // the Lounge has loaded
  await expect(lounge.getByText(text)).toHaveCount(0);
});

test("the notification bell shows another account's reply", async ({ page }) => {
  const title = `${prefix} bell`;
  const reply = `${prefix} hello`;
  // Start from an empty bell, so older unread rows from the tests above can't make it busy.
  await cleanup('notifications', `user_id=eq.${STUDENT}`);
  await adminInsert('threads', { board_id: CAMPUS_BUZZ, author_id: STUDENT, title, body: 'Waiting for a reply.' });
  await signIn(page, 'e2e.student', '/b/campus-buzz?tab=new');
  await page.getByRole('link', { name: title }).first().click();
  await expect(page).toHaveURL(/\/b\/campus-buzz\/\d+$/);
  const threadId = Number(new URL(page.url()).pathname.split('/').pop());

  await adminInsert('replies', { thread_id: threadId, author_id: MODERATOR, body: reply });
  await page.reload();
  await page.getByRole('button', { name: /Notifications \(\d+ unread\)/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifications' }).getByText(reply)).toBeVisible();
});
