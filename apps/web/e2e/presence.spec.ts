import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// #41: signed-in students see who's online; visitors only see how many.
test('a visitor sees the online count but not who is online', async ({ browser }) => {
  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  await signIn(student, 'e2e.student', '/boards');
  const box = (page: typeof student) => page.getByRole('region', { name: 'Who’s online' });

  // The student shows up by name for students.
  await expect(box(student).getByRole('link', { name: 'e2e.student' })).toBeVisible({ timeout: 15_000 });

  // A visitor in another browser gets a count of at least that one student, and no names.
  const visitorCtx = await browser.newContext();
  const visitor = await visitorCtx.newPage();
  await visitor.goto('/boards');
  await expect
    .poll(async () => Number((await box(visitor).textContent())?.match(/Who.s online · (\d+)/)?.[1] ?? 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await expect(box(visitor).getByText(/to see who.s here/)).toBeVisible();
  await expect(box(visitor).getByRole('link', { name: 'e2e.student' })).toHaveCount(0);

  await studentCtx.close();
  await visitorCtx.close();
});
