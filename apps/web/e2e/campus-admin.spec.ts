import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

// #61: a moderator adds a campus event on /mod, sees it in Today, and deletes it; a member can't open /mod.
const title = `e2e event ${Date.now()}`;

test.afterAll(async () => {
  await cleanup('campus_events', `title=like.${encodeURIComponent('e2e event %')}`);
});

test('a moderator adds and deletes a Today event', async ({ page }) => {
  await signIn(page, 'e2e.moderator', '/mod');
  await page.waitForLoadState('networkidle'); // let the form hydrate, or Add submits natively
  const add = page.getByRole('form', { name: 'Add to Today at DTU' });
  const now = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 11) + '23:30';
  await add.getByLabel('Starts (IST)').fill(now);
  await add.getByLabel('Title', { exact: true }).fill(title);
  await add.getByRole('button', { name: 'Add' }).click();

  const edit = page.getByRole('form', { name: `Edit ${title}` });
  await expect(edit).toBeVisible();
  await page.goto('/');
  await expect(page.getByText(title).first()).toBeVisible();

  await page.goto('/mod');
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('form', { name: `Edit ${title}` })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByRole('form', { name: `Edit ${title}` })).toHaveCount(0);
});

test('a member cannot open the campus editor', async ({ page }) => {
  await signIn(page, 'e2e.student', '/');
  await page.goto('/mod');
  await expect(page.getByText('Campus content')).toHaveCount(0);
  await expect(page.getByText('Moderation', { exact: true })).toHaveCount(0);
});
