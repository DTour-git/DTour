#!/usr/bin/env node
// Regenerates packages/shared/src/database.types.ts from the LOCAL Supabase stack, so it
// reflects exactly what supabase/migrations builds, formatted the way the file is committed.
// Start the stack first: npx supabase@3.1.0 start
// Usage: npm run db:types            → write the file
//        npm run db:types -- --check → fail with a diff if the committed file is out of date (CI)
// Any other arguments go to `supabase gen types` (for example --workdir <dir>).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format } from 'prettier';
import { fail, ROOT } from './dev-env.mjs';

// Keep in step with the version the dev-db job in .github/workflows/ci.yml starts.
const SUPABASE_CLI = 'supabase@3.1.0';
const FILE = 'packages/shared/src/database.types.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const extra = args.filter((a) => a !== '--check');
if (extra.some((a) => /^--(remote|linked|project-id|db-url)\b/.test(a)))
  fail('db:types only reads the local stack. It is what CI compares against.');

const gen = spawnSync(
  'npm',
  ['exec', '--yes', `--package=${SUPABASE_CLI}`, '--', 'supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public', ...extra],
  { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 },
);
if (gen.status !== 0 || !gen.stdout.includes('export type Database'))
  fail('supabase gen types failed. Is the local stack running (npx supabase@3.1.0 start)?');

// The CLI prints unformatted TypeScript. The committed file is Prettier's defaults without
// semicolons (it is in .prettierignore, so the repo's own config never touches it).
const generated = await format(gen.stdout, { parser: 'typescript', semi: false });
const path = join(ROOT, FILE);

if (!check) {
  writeFileSync(path, generated);
  console.log(`Wrote ${FILE}.`);
  process.exit(0);
}

if (readFileSync(path, 'utf8') === generated) {
  console.log(`${FILE} matches the migrations.`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'db-types-'));
const fresh = join(dir, 'database.types.ts');
writeFileSync(fresh, generated);
spawnSync('git', ['--no-pager', 'diff', '--no-index', '--', path, fresh], { cwd: ROOT, stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });

const msg =
  `${FILE} does not match supabase/migrations (diff above: - committed, + generated). ` +
  'Do not hand-edit it: start a fresh local stack, run `npm run db:types`, and commit the result.';
if (process.env.GITHUB_ACTIONS) console.log(`::error file=${FILE}::${msg}`);
fail(msg);
