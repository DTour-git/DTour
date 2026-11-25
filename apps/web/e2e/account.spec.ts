import { expect, test } from '@playwright/test';
import { adminInsert, cleanup, devAdmin, signIn } from './helpers';

// A throwaway account (made through the admin API) deletes itself from Settings (#14).
const stamp = Date.now();
const email = `e2e.deleteme${stamp}@dtu.ac.in`;
const handle = `e2e_deleteme${stamp}`.slice(0, 24);
const title = `e2e account thread ${stamp}`;
let userId = '';

const rest = async (path: string, init?: RequestInit) =>
  (await fetch(`${devAdmin.url}/rest/v1/${path}`, { ...init, headers: { ...devAdmin.headers, ...init?.headers } })).json();

test.afterAll(async () => {
  await cleanup('threads', `title=eq.${encodeURIComponent(title)}`);
  if (userId) await fetch(`${devAdmin.url}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: devAdmin.headers });
});

test('a student can delete their account from Settings and their post stays anonymous', async ({ page }) => {
  const res = await fetch(`${devAdmin.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: devAdmin.headers,
    body: JSON.stringify({ email, email_confirm: true }),
  });
  userId = (await res.json()).id;
  expect(userId).toBeTruthy();
  await fetch(`${devAdmin.url}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: devAdmin.headers,
    body: JSON.stringify({ handle, onboarded: true }),
  });
  await adminInsert('threads', { board_id: '00000000-0000-4000-8000-000000000201', author_id: userId, title, body: 'Left behind.' });

  await signIn(page, email, `/u/${handle}`);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByText('[deleted user]')).toBeVisible();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page).toHaveURL(/\/login/);

  expect(await rest(`profiles?id=eq.${userId}&select=id`)).toEqual([]);
  expect(await rest(`threads?title=eq.${encodeURIComponent(title)}&select=author_id`)).toEqual([{ author_id: null }]);
});
