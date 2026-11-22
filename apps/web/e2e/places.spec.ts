import { expect, test } from '@playwright/test';
import { adminInsert, cleanup, signIn } from './helpers';

// #28: a place can be deleted by whoever added it, and the Today page's team
// box never headlines a team whose deadline has passed.
const STUDENT = '00000000-0000-4000-8000-00000000e2e1';
const stamp = Date.now();
const place = `e2e place ${stamp}`;
const pastTeam = `e2e past team ${stamp}`;
const soonTeam = `e2e soon team ${stamp}`;

const isoDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test.afterAll(async () => {
  await cleanup('places', `name=like.${encodeURIComponent('e2e place %')}`);
  await cleanup('teams', `title=like.${encodeURIComponent('e2e % team %')}`);
});

test('a student can delete a place they added', async ({ page }) => {
  await adminInsert('places', { author_id: STUDENT, category: 'chill', name: place, where_label: 'Behind the library', sort: 50 });
  await signIn(page, 'e2e.student', '/kahan-chalein');
  const card = page
    .locator('div', { hasText: place })
    .filter({ has: page.getByRole('button', { name: 'Delete' }) })
    .last();
  await expect(card).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(place)).toHaveCount(0);
});

test("other people's places have no delete link", async ({ page }) => {
  await signIn(page, 'e2e.student', '/kahan-chalein');
  await expect(page.getByText('Chill spots').first()).toBeVisible();
  // The seeded places belong to demo students, so a member sees no Delete or Remove on them.
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
});

test('the Today page skips teams whose deadline has passed', async ({ page }) => {
  await adminInsert('teams', [
    { owner_id: STUDENT, category: 'hackathon', event_name: 'e2e', title: pastTeam, short_title: pastTeam, deadline_on: '2020-01-01' },
    { owner_id: STUDENT, category: 'hackathon', event_name: 'e2e', title: soonTeam, short_title: soonTeam, deadline_on: isoDate(1) },
  ]);
  await page.goto('/');
  await expect(page.getByText(soonTeam).first()).toBeVisible();
  await expect(page.getByText(pastTeam)).toHaveCount(0);
});
