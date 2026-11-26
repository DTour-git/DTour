import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('the PR workflow does not read repository secrets', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  expect(workflow).not.toMatch(/\$\{\{[^}]*\bsecrets\b/i);
});

test('the dev-db job checks the DB types with the same Supabase CLI it starts', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const script = readFileSync(new URL('./db-types.mjs', import.meta.url), 'utf8');
  const devDb = workflow.slice(workflow.indexOf('\n  dev-db:'));
  expect(devDb).toContain('npm run db:types -- --check');
  const started = /--package=(supabase@[\d.]+) -- supabase start/.exec(devDb)?.[1];
  expect(started).toBeTruthy();
  expect(script).toContain(`'${started}'`);
});
