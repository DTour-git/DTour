import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

// #62: a moderator creates a society on /mod with e2e.student as its first lead; the
// student adds a member from "Your societies" on /societies, and can't leave as the
// last lead. The society starts with the `e2e-soc-` slug and is removed in afterAll
// (its memberships cascade).
const stamp = Date.now();
const slug = `e2e-soc-${stamp}`;
const name = `e2e soc ${stamp}`;

test.afterAll(async () => {
  await cleanup('societies', `slug=like.${encodeURIComponent('e2e-soc-%')}`);
});

test('a moderator creates a society and its lead manages members', async ({ page }) => {
  await signIn(page, 'e2e.moderator', '/mod');
  await page.waitForLoadState('networkidle'); // let the form hydrate, or Add submits natively
  const add = page.getByRole('form', { name: 'Add to Societies' });
  await add.getByLabel('Slug (fixed once created)').fill(slug);
  await add.getByLabel('Name', { exact: true }).fill(name);
  await add.getByLabel('Add a lead (handle)').fill('e2e.student');
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('form', { name: `Edit ${name}` })).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, 'e2e.student', '/societies');
  await page.waitForLoadState('networkidle');
  const row = page.locator('.row-rule').filter({ hasText: name }).first();
  await expect(row).toContainText('lead');
  await row.getByRole('button', { name: 'Manage' }).click();

  const addMember = page.getByRole('form', { name: `Add a member to ${name}` });
  await addMember.getByLabel('Handle').fill('e2e.moderator');
  await addMember.getByLabel('Role').fill('Treasurer');
  await addMember.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('textbox', { name: 'Role of @e2e.moderator' })).toHaveValue('Treasurer');

  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByText('A society needs at least one lead', { exact: false })).toBeVisible();
});
