// Loads the dev Supabase settings from .env.dev (or the environment, in CI) and refuses
// to continue if anything points at the production project.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PROD_REF = 'megohwzcghnbfdzsaypz';
const KEYS = ['DEV_SUPABASE_URL', 'DEV_SUPABASE_PUBLISHABLE_KEY', 'DEV_SUPABASE_SECRET_KEY', 'DEV_DB_URL'];

export function loadDevEnv({ need = KEYS } = {}) {
  const file = join(ROOT, '.env.dev');
  const env = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
    }
  }
  for (const k of KEYS) if (process.env[k]) env[k] = process.env[k];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) fail(`Missing ${missing.join(', ')}. Copy .env.dev.example to .env.dev and fill it in.`);
  for (const k of KEYS)
    if (env[k]?.includes(PROD_REF))
      fail(`${k} points at the PRODUCTION project (${PROD_REF}). Dev tooling only runs against the dev project.`);
  return env;
}

export function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
