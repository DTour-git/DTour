<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Measuring page load

`npm run bench:pages` times the home page, a board, two threads (one with replies and an attachment, one with a poll), a wiki article and a profile, signed out and signed in as `e2e.student`. It prints TTFB and total load time (median and p95, in ms) after a warm-up. It lives in `scripts/bench-pages.mjs` rather than `e2e/`, so `npm run test:e2e` never runs it.

1. Build and serve a production build against the database you want to measure, for example `cd apps/web && npx next build && npx next start --port 3100`, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to that project. `next dev` numbers are meaningless.
2. Run `npm run bench:pages -- --base http://localhost:3100` (or set `BENCH_BASE_URL`). Other flags: `--runs 20`, `--warmup 3`, `--only thread`, `--json out.json`.
3. Signed-in pages need `DEV_SUPABASE_URL` and `DEV_SUPABASE_SECRET_KEY` for the same project, from `.env.dev` or the environment. The script refuses production values. Without them it only runs the signed-out pages.

**Local stack:** `supabase start`, apply `supabase/dev/fixtures.sql`, and point the build and the script at the printed API URL. Local numbers have almost no network latency, so they show server work only.

**Hosted dev:** use the dev project's URL and keys (from a maintainer) in `.env.dev`, and build with the same URL. Compare runs from the same machine and network. The pages use seed data (`coe-sem-3`, threads 1 and 9, `the-week-before-end-sems`, `segfault_sneha`), so run it after `npm run db:dev:reset`.
