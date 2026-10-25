// Runs the pgTAP tests in supabase/tests/database against the DEV database.
// Each file runs inside a transaction that is rolled back, so tests leave no data behind.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadDevEnv, ROOT } from './dev-env.mjs';

const { DEV_DB_URL } = loadDevEnv({ need: ['DEV_DB_URL'] });
const psql = (args) =>
  execFileSync('psql', [DEV_DB_URL, '-v', 'ON_ERROR_STOP=1', '-X', '-q', ...args], {
    encoding: 'utf8',
    input: '',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

psql(['-f', join(ROOT, 'supabase/dev/fixtures.sql')]); // idempotent: makes sure test accounts + pgTAP exist

const dir = join(ROOT, 'supabase/tests/database');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.sql'))
  .sort();
let failed = 0;
for (const f of files) {
  let out;
  try {
    out = psql(['-At', '-f', join(dir, f)]);
  } catch (e) {
    out = `${e.stdout ?? ''}\n${e.stderr ?? e.message}`;
    failed++;
    console.log(`✖ ${f}\n${out}`);
    continue;
  }
  const lines = out.split('\n').filter((l) => /^(not )?ok /.test(l) || l.startsWith('#'));
  const bad = lines.filter((l) => l.startsWith('not ok') || /# Looks like/.test(l));
  if (bad.length) {
    failed++;
    console.log(`✖ ${f}\n${lines.join('\n')}`);
  } else console.log(`✓ ${f} (${lines.filter((l) => l.startsWith('ok')).length} checks)`);
}
if (failed) {
  console.error(`\n${failed} database test file(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} database test files passed`);
