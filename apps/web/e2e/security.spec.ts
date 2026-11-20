import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// #42: security headers on every response, and session cookies that never go over plain http.

test('pages send the security headers', async ({ request }) => {
  for (const path of ['/', '/login', '/boards']) {
    const headers = (await request.get(path)).headers();
    expect(headers['strict-transport-security'], path).toBe('max-age=31536000');
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy'], path).toBe("frame-ancestors 'none'");
  }
});

test('the session cookies are Secure and SameSite=Lax', async ({ page }) => {
  await signIn(page);
  // The browser client refreshes the session too; give it a page that uses it.
  await page.goto('/boards');
  const session = (await page.context().cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));
  expect(session.length).toBeGreaterThan(0);
  for (const c of session) {
    expect(c.secure, c.name).toBe(true);
    expect(c.sameSite, c.name).toBe('Lax');
    expect(c.path, c.name).toBe('/');
  }
});
