import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

// #64: e2e.moderator suspends e2e.student from /mod; the student is told why when
// they try to reply; the moderator lifts it. The suspension is removed before and
// after, so a failed run can't leave the student suspended for the other specs.
const STUDENT = '00000000-0000-4000-8000-00000000e2e1';
const reason = `e2e suspend ${Date.now()}`;
const clear = () => cleanup('suspensions', `user_id=eq.${STUDENT}`);

test.beforeAll(clear);
test.afterAll(clear);

test('a moderator suspends a student, who then cannot reply, and lifts it', async ({ page }) => {
  await signIn(page, 'e2e.moderator', '/mod');
  await page.waitForLoadState('networkidle'); // let the form hydrate, or Suspend submits natively
  const form = page.getByRole('form', { name: 'Suspend a member' });
  await form.getByLabel('Handle', { exact: true }).fill('e2e.student');
  await form.getByLabel('Reason (the member sees this)', { exact: true }).fill(reason);
  await form.getByLabel('For', { exact: true }).selectOption({ label: '1 day' });
  await form.getByRole('button', { name: 'Suspend' }).click();
  const active = page
    .locator('.row-rule')
    .filter({ hasText: reason })
    .filter({ has: page.getByRole('button', { name: 'Lift' }) });
  await expect(active).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, 'e2e.student', '/b/campus-buzz/3');
  await page.getByRole('button', { name: /Add a reply/ }).click();
  await expect(page.getByText(`Reason: ${reason}`)).toBeVisible();
  await expect(page.getByPlaceholder('Add a reply…')).toHaveCount(0);

  await page.context().clearCookies();
  await signIn(page, 'e2e.moderator', '/mod');
  await page.waitForLoadState('networkidle');
  page.once('dialog', (d) => d.accept());
  await active.getByRole('button', { name: 'Lift' }).click();
  await expect(active).toHaveCount(0);
});
