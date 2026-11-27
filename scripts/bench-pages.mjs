// Page-load benchmark for the website, signed out and signed in as the dev test account.
//
//   npm run bench:pages                      # against http://localhost:3100
//   npm run bench:pages -- --base http://localhost:3000 --runs 30
//   BENCH_BASE_URL=https://<preview-url> npm run bench:pages
//
// Point it at a PRODUCTION build (`next build` + `next start`), not `next dev`: dev mode
// compiles on demand and its numbers mean nothing. The build must use the same Supabase
// project as DEV_SUPABASE_URL (the benchmark signs in through that project's admin API).
//
// Signed-in runs need DEV_SUPABASE_URL and DEV_SUPABASE_SECRET_KEY (from .env.dev or the
// environment); dev-env.mjs refuses production values. Without them only signed-out pages run.
//
// For each page it loads it `--warmup` times (not counted), then `--runs` times, in a context
// whose HTTP cache is warm after the first load. Reported per page, in milliseconds:
//   TTFB   navigation start to first response byte (server render + network)
//   load   navigation start to the window load event (includes scripts, images, fonts)
// Optional flags: --json <file> writes the raw samples; --only <substring> filters pages.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { loadDevEnv, ROOT } from './dev-env.mjs';

const require = createRequire(join(ROOT, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = flag('base', process.env.BENCH_BASE_URL ?? 'http://localhost:3100').replace(/\/$/, '');
const RUNS = Number(flag('runs', process.env.BENCH_RUNS ?? 20));
const WARMUP = Number(flag('warmup', process.env.BENCH_WARMUP ?? 3));
const ONLY = flag('only', '');
const JSON_OUT = flag('json', '');
const HANDLE = flag('handle', 'e2e.student');

// Slugs and ids from supabase/seed.sql (the same demo content is on dev and local stacks).
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'board', path: '/b/coe-sem-3' },
  { name: 'thread (replies + attachment)', path: '/b/coe-sem-3/1' },
  { name: 'thread (poll)', path: '/b/food-hangouts/9' },
  { name: 'wiki article', path: '/wiki/the-week-before-end-sems' },
  { name: 'profile', path: '/u/segfault_sneha' },
].filter((p) => p.name.includes(ONLY) || p.path.includes(ONLY));

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const p95 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};
const ms = (n) => String(Math.round(n));

async function signedInContext(browser) {
  const env = loadDevEnv({ need: ['DEV_SUPABASE_URL', 'DEV_SUPABASE_SECRET_KEY'] });
  const res = await fetch(`${env.DEV_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: env.DEV_SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.DEV_SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: `${HANDLE}@dtour.invalid` }),
  });
  const body = await res.json();
  const hash = body.hashed_token ?? body.properties?.hashed_token;
  if (!hash) throw new Error(`No sign-in link for ${HANDLE}: ${JSON.stringify(body)}`);
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/confirm?token_hash=${hash}&type=magiclink&next=%2F`);
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') && !u.pathname.startsWith('/login'));
  await page.close();
  return ctx;
}

async function sample(ctx, path) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(BASE + path, { waitUntil: 'load' });
    if (!res || res.status() >= 400) throw new Error(`${path} answered ${res?.status()}`);
    await page.waitForFunction(() => performance.getEntriesByType('navigation')[0]?.loadEventEnd > 0);
    return await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return { ttfb: n.responseStart - n.startTime, load: n.loadEventEnd - n.startTime };
    });
  } finally {
    await page.close();
  }
}

async function measure(ctx, label) {
  const rows = [];
  for (const p of PAGES) {
    for (let i = 0; i < WARMUP; i++) await sample(ctx, p.path);
    const ttfb = [];
    const load = [];
    for (let i = 0; i < RUNS; i++) {
      const s = await sample(ctx, p.path);
      ttfb.push(s.ttfb);
      load.push(s.load);
    }
    rows.push({ mode: label, page: p.name, path: p.path, ttfb, load });
    console.error(`  ${label} ${p.path}: TTFB median ${ms(median(ttfb))} ms`);
  }
  return rows;
}

function table(rows) {
  const out = ['| Page | TTFB median | TTFB p95 | Load median | Load p95 |', '|---|--:|--:|--:|--:|'];
  for (const r of rows)
    out.push(`| ${r.page} \`${r.path}\` | ${ms(median(r.ttfb))} | ${ms(p95(r.ttfb))} | ${ms(median(r.load))} | ${ms(p95(r.load))} |`);
  return out.join('\n');
}

const browser = await chromium.launch();
const results = [];
try {
  console.error(`Benchmarking ${BASE}: ${WARMUP} warm-up + ${RUNS} measured loads per page`);
  const anon = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  results.push(...(await measure(anon, 'signed out')));
  await anon.close();
  try {
    const member = await signedInContext(browser);
    results.push(...(await measure(member, 'signed in')));
    await member.close();
  } catch (e) {
    console.error(`Skipping signed-in pages: ${e.message}`);
  }
} finally {
  await browser.close();
}

console.log(`\nBase URL: ${BASE} | warm-up ${WARMUP}, measured ${RUNS} per page | times in ms\n`);
for (const mode of ['signed out', 'signed in']) {
  const rows = results.filter((r) => r.mode === mode);
  if (rows.length) console.log(`### ${mode[0].toUpperCase() + mode.slice(1)}\n\n${table(rows)}\n`);
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, runs: RUNS, warmup: WARMUP, results }, null, 2));
