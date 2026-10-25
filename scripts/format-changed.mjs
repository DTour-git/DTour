#!/usr/bin/env node
// Formats only files this branch changed (vs origin/main, plus uncommitted/untracked),
// so formatting never rewrites files other people are working on.
// Usage: npm run format            → write
//        npm run format -- --check → check only
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ROOT } from './dev-env.mjs';

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const base = git('merge-base', 'HEAD', 'origin/main')[0];
const files = [
  ...new Set([
    ...(base ? git('diff', '--name-only', '--diff-filter=ACMR', base) : []),
    ...git('diff', '--name-only', '--diff-filter=ACMR'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ]),
].filter((f) => /\.(ts|tsx|js|mjs|cjs|jsx|json|css|ya?ml)$/.test(f) && existsSync(`${ROOT}/${f}`));

if (!files.length) {
  console.log('No changed files to format.');
  process.exit(0);
}

const mode = process.argv.includes('--check') ? '--check' : '--write';
const r = spawnSync('npx', ['prettier', mode, '--ignore-unknown', ...files], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);
