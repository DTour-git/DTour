import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('the OAuth callback redirects only to a local path', async ({ request }) => {
  for (const next of ['//example.invalid', '/\\example.invalid', '/\t/example.invalid', '/%2e//example.invalid']) {
    const response = await request.get(`/auth/callback?next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(new URL('/', response.url()).href);
  }

  const next = '/boards?sort=recent#top';
  const response = await request.get(`/auth/callback?next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
  expect(response.headers().location).toBe(new URL(next, response.url()).href);
});

test('an email sign-in link cannot send the member off-site', async ({ page }) => {
  await page.route('**://example.invalid/**', (route) => route.fulfill({ body: 'External site' }));
  await signIn(page, 'e2e.student', '//example.invalid');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible();
});

test('email code sign-in keeps its next destination on-site', async ({ page }) => {
  await page.route('**://example.invalid/**', (route) => route.fulfill({ body: 'External site' }));
  await page.route('**/auth/v1/otp?**', (route) => route.fulfill({ json: {} }));
  await page.route('**/auth/v1/verify', (route) => route.fulfill({ json: {} }));
  await page.goto('/login?next=%2F%2Fexample.invalid');
  await page.getByLabel('DTU email').fill('e2e.student@dtu.ac.in');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
});

test('the sign-in alert never shows text from the link', async ({ page }) => {
  const bait = 'Your DTour account is locked. Call +91 90000 00000 to unlock it.';
  await page.goto(`/login?error=${encodeURIComponent(bait)}`);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Sign-in didn’t go through. Please try again.');
  await expect(page.getByText(bait)).toHaveCount(0);

  await page.goto('/login?error=not_dtu');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'DTour is only for DTU students — sign in with your @dtu.ac.in email.',
  );
});

test('auth redirects send an error code, not Supabase text', async ({ request }) => {
  const bait = 'Your DTour account is locked. Call +91 90000 00000.';
  const callback = await request.get(`/auth/callback?error=access_denied&error_description=${encodeURIComponent(bait)}`, {
    maxRedirects: 0,
  });
  expect(callback.headers().location).toBe(new URL('/login?error=cancelled', callback.url()).href);

  const confirm = await request.get('/auth/confirm', { maxRedirects: 0 });
  expect(confirm.headers().location).toBe(new URL('/login?error=link_expired', confirm.url()).href);
});
