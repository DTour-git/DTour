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

// Deleting the account removes the images nothing on DTour uses, and keeps the ones a kept post shows (#133).
const mediaEmail = `e2e.deletemedia${stamp}@dtu.ac.in`;
const mediaHandle = `e2e_delmedia${stamp}`.slice(0, 24);
const mediaTitle = `e2e account media thread ${stamp}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64');
let mediaUserId = '';

const storage = (path: string, init?: RequestInit) =>
  fetch(`${devAdmin.url}/storage/v1/${path}`, { ...init, headers: { ...devAdmin.headers, ...init?.headers } });
const mediaNames = async (uid: string): Promise<string[]> => {
  const res = await storage('object/list/media', { method: 'POST', body: JSON.stringify({ prefix: uid, limit: 100 }) });
  return ((await res.json()) as { name: string }[]).map((f) => f.name).sort();
};

test.afterAll(async () => {
  await cleanup('threads', `title=eq.${encodeURIComponent(mediaTitle)}`);
  if (!mediaUserId) return;
  const left = await mediaNames(mediaUserId);
  if (left.length)
    await storage('object/media', { method: 'DELETE', body: JSON.stringify({ prefixes: left.map((n) => `${mediaUserId}/${n}`) }) });
  await fetch(`${devAdmin.url}/auth/v1/admin/users/${mediaUserId}`, { method: 'DELETE', headers: devAdmin.headers });
});

test('deleting an account removes the images nothing uses and keeps the ones a post still shows', async ({ page }) => {
  const res = await fetch(`${devAdmin.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: devAdmin.headers,
    body: JSON.stringify({ email: mediaEmail, email_confirm: true }),
  });
  mediaUserId = (await res.json()).id;
  expect(mediaUserId).toBeTruthy();
  await fetch(`${devAdmin.url}/rest/v1/profiles?id=eq.${mediaUserId}`, {
    method: 'PATCH',
    headers: devAdmin.headers,
    body: JSON.stringify({ handle: mediaHandle, onboarded: true }),
  });
  for (const name of ['in-post.png', 'unused.png']) {
    const up = await storage(`object/media/${mediaUserId}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: png,
    });
    expect(up.ok).toBe(true);
  }
  const publicUrl = (name: string) => `${devAdmin.url}/storage/v1/object/public/media/${mediaUserId}/${name}`;
  await adminInsert('threads', {
    board_id: '00000000-0000-4000-8000-000000000201',
    author_id: mediaUserId,
    title: mediaTitle,
    body: `A photo: ![photo](${publicUrl('in-post.png')})`,
  });
  expect(await mediaNames(mediaUserId)).toEqual(['in-post.png', 'unused.png']);

  await signIn(page, mediaEmail, `/u/${mediaHandle}`);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByText('any images you uploaded that nothing on DTour still shows')).toBeVisible();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page).toHaveURL(/\/login/);

  expect(await rest(`profiles?id=eq.${mediaUserId}&select=id`)).toEqual([]);
  expect(await mediaNames(mediaUserId)).toEqual(['in-post.png']);
  expect((await fetch(publicUrl('in-post.png'))).status).toBe(200);
  expect((await fetch(publicUrl('unused.png'))).status).not.toBe(200);
});
