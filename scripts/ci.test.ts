import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('the PR workflow does not read repository secrets', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  expect(workflow).not.toMatch(/\$\{\{[^}]*\bsecrets\b/i);
});
