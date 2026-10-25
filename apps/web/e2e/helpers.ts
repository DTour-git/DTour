import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

// Same rules as scripts/dev-env.mjs: read .env.dev (or CI env vars) and never touch production.
const PROD_REF = 'megohwzcghnbfdzsaypz';
function devEnv() {
  const env: Record<string, string> = {};
  const file = join(__dirname, '../../../.env.dev');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
    }
  }
  for (const k of ['DEV_SUPABASE_URL', 'DEV_SUPABASE_SECRET_KEY']) {
    if (process.env[k]) env[k] = process.env[k]!;
    if (!env[k]) throw new Error(`${k} is missing — copy .env.dev.example to .env.dev`);
    if (env[k].includes(PROD_REF)) throw new Error(`${k} points at PRODUCTION — e2e tests only run against dev`);
  }
  return env;
}
const env = devEnv();
const admin = {
  apikey: env.DEV_SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.DEV_SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

/** Signs the page in as a dev test account through a one-time magic link. */
export async function signIn(page: Page, handle = 'e2e.student') {
  const res = await fetch(`${env.DEV_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ type: 'magiclink', email: `${handle}@dtour.invalid` }),
  });
  const body = await res.json();
  const hash = body.hashed_token ?? body.properties?.hashed_token;
  if (!hash) throw new Error(`No sign-in link for ${handle}: ${JSON.stringify(body)}`);
  await page.goto(`/auth/confirm?token_hash=${hash}&type=magiclink`);
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') && !u.pathname.startsWith('/login'));
}

/** Deletes rows the tests created, using the dev secret key (bypasses RLS). */
export async function cleanup(table: string, filter: string) {
  await fetch(`${env.DEV_SUPABASE_URL}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: admin });
}
