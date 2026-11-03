import { expect, test } from '@playwright/test';
import { cleanup, signIn } from './helpers';

const marker = `e2e suspension ${Date.now()}`;

test.afterAll(async () => {
  await cleanup('member_suspensions', `reason=eq.${encodeURIComponent(marker)}`);
  await cleanup('suspension_events', `reason=eq.${encodeURIComponent(marker)}`);
});

test('moderator suspends and restores a member', async ({ browser }) => {
  const modContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const mod = await modContext.newPage();
    const member = await memberContext.newPage();
    await signIn(mod, 'e2e.moderator');
    await mod.goto('/mod');
    await mod.getByLabel('Member handle').fill('e2e.student');
    await mod.getByLabel('Reason', { exact: true }).fill(marker);
    await mod.getByLabel('Show the reason to the member').check();
    await mod.getByRole('button', { name: 'Suspend member' }).click();
    await expect(mod.getByText('Member suspended.')).toBeVisible();
    await signIn(member, 'e2e.student');
    await member.goto('/b/campus-buzz/3');
    await member.getByRole('button', { name: /Add a reply/ }).click();
    await expect(member.getByText(new RegExp(marker))).toBeVisible();
    await mod.getByLabel('Reason', { exact: true }).fill(marker);
    await mod.getByRole('button', { name: 'Lift suspension' }).click();
    await expect(mod.getByText('Suspension lifted.')).toBeVisible();
    await member.reload();
    await member.getByRole('button', { name: /Add a reply/ }).click();
    await expect(member.getByPlaceholder('Add a reply…')).toBeVisible();
  } finally {
    await memberContext.close();
    await modContext.close();
  }
});
