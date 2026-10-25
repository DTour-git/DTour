// Wipes the DEV database and rebuilds it: all migrations, demo seed, then test accounts.
// Refuses to run against production.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { loadDevEnv, ROOT } from './dev-env.mjs';

const { DEV_DB_URL } = loadDevEnv({ need: ['DEV_DB_URL'] });
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT });

console.log('→ resetting the DEV database (migrations + seed)…');
run('supabase', ['db', 'reset', '--db-url', DEV_DB_URL, '--yes']);
console.log('→ adding test accounts…');
run('psql', [DEV_DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(ROOT, 'supabase/dev/fixtures.sql')]);
console.log('✓ dev database rebuilt');
