# AGENTS.md — DTour

Guidance for anyone, human or AI agent, working in this repository. Read this first. Then read the app-specific guide for whatever you touch: `apps/web/AGENTS.md` (Next.js) or `apps/mobile/AGENTS.md` (Expo).

## What DTour is

DTour is a community platform for DTU (Delhi Technological University) students. It covers campus news ("Pata hai aaj kya hua?"), discussion boards with votes and karma, a student-written wiki, a notes and PYQ library, the society board, Team Up (hackathon team-finding), Kahan chalein? (food and hangouts), and the Lounge (live chat).

The website and the mobile app share a single Supabase backend.

## Design is the source of truth

- `design_handoff_dtour/` holds the final design: `README.md` (the spec), clickable prototypes in `prototype/`, tokens in `tokens/broadsheet.css`, and `screenshots/`. Match it closely: colours, type, spacing and copy.
- **Ask before changing the design or adding features.** If the design doesn't cover something, build it in the same visual language (Broadsheet: Source Serif 4, whitespace, thick-and-thin rules, CMYK plate numerals, halftone images) and say so in the PR.
- Use Source Serif 4 everywhere: no sans-serif in the UI. Icons are Phosphor, **duotone** weight.

## Repository layout

npm workspaces monorepo:

| Path | What |
|---|---|
| `apps/web` | Website. Next.js 16 (App Router), React 19, TypeScript. Package `@dtour/web`. |
| `apps/mobile` | iOS + Android app. Expo SDK 58, React Native 0.88, Expo Router. Package `@dtour/mobile`. |
| `packages/shared` | Code both apps import as `@dtour/shared`: data API (`api.ts`), design tokens (`tokens.ts`), fzf-style search (`fuzzy.ts`), formatting (`format.ts`), markdown parser (`markdown.ts`), generated DB types (`database.types.ts`). |
| `supabase/` | `migrations/` (schema, RLS, triggers, RPCs), `seed.sql` (demo content), `functions/push` (phone-push edge function), `config.toml`. |
| `design_handoff_dtour/` | Design reference. Read-only. |

## Commands

Run from the repo root unless noted.

```bash
npm ci                     # install everything (use `npx expo install <pkg>` in apps/mobile to add mobile deps)
npm run web                # website at http://localhost:3000
npm run mobile             # Expo dev server for Expo Go (scan QR; press w for web)
npm run start:dev -w @dtour/mobile   # for a development build (needed for phone push)
npm run web:dev-db         # website, but pointed at the DEV Supabase project (safe to write test data)
npm run mobile:dev-db      # same for the mobile app

npm run check              # typecheck + lint (web, mobile) + unit tests + web build — run before every PR
npm run check:all          # check + database tests + browser tests (needs .env.dev)
npm run check:migrations   # migration names, unique versions, newer than origin/main (also in CI)
npm test                   # unit tests only (Vitest), `npm run test:watch` while working
npm run test:db            # pgTAP tests in supabase/tests/database against the dev DB
npm run test:e2e           # Playwright tests in apps/web/e2e against the dev DB (builds and serves on :3100)
npm run db:dev:reset       # wipe and rebuild the DEV database: migrations + seed + test accounts
npm run dev:login -- e2e.student     # print a one-click sign-in link for a dev test account
npm run format             # Prettier on files your branch changed (never the whole repo)
npm run format:check       # Prettier check over the whole repo (what CI runs)
npm run icons              # regenerate the website's icon paths after adding an icon
```

**Before you call a change done**, run `npm run check`. If you changed SQL, also run `npm run test:db`; if you changed a web flow, also run `npm run test:e2e`. If you changed mobile code, also confirm it bundles: `cd apps/mobile && npx expo export --platform android --output-dir /tmp/x`.

CI (`.github/workflows/ci.yml`) runs two jobs on every PR and every push to `main`. **check** runs the Prettier check, typecheck, lint, unit tests, and the web build. **dev-db** runs database and browser tests against a fresh local Supabase stack on each runner. It uses local test credentials and requires no hosted Supabase secrets.

## Tests

| Kind | Where | Add one when… |
|---|---|---|
| Unit (Vitest) | `packages/shared/src/*.test.ts`, `apps/mobile/src/lib/*.test.ts` | you change pure logic: search ranking, formatting, markdown, sorting, route mapping |
| Database (pgTAP) | `supabase/tests/database/NN_*.test.sql` | you add or change RLS, a trigger, an RPC or the auth hook |
| Browser (Playwright) | `apps/web/e2e/*.spec.ts` | you add or change a user flow on the website |

- DB tests run inside `begin … rollback`, so they leave nothing behind. Use the helpers in `00_helpers.sql`: `pg_temp.try_as(role, uid, sql)` returns `'ok'` or the error code, `pg_temp.count_as(role, uid, sql)` counts rows visible to that user.
- E2E tests that write must use a unique marker and clean up in `afterAll` (see `member.spec.ts`).
- **Test accounts** (dev only, from `supabase/dev/fixtures.sql`): `e2e.student@dtour.invalid` (member) and `e2e.moderator@dtour.invalid` (moderator). Sign in as them with `npm run dev:login -- <handle>`; there is no password.

## Environment and secrets

- `apps/web/.env.local` sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `apps/mobile/.env` sets `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SITE_URL` (web) is the public address of the site, used in share-image links, `robots.txt` and the sitemap. Set it in the host's build environment: without it those links point at `http://localhost:3000`.
- Copy each from the `.env.example` next to it. These files are gitignored. **Never commit them.**
- Apps only ever get the **publishable** key. The **secret** (service-role) key, database passwords and OAuth client secrets never go in the repo, in app env files, or in client code.
- **Two Supabase projects:**
  - **Production: `megohwzcghnbfdzsaypz`.** The real site. The CLI link (`supabase/.temp`) points here. Never write test data to it.
  - **Dev: `cqdqfmejbwvumbbclkfk`** (`dtour-dev`). Same migrations, demo seed and two test accounts. Use it for tests, experiments and agent work. Its keys go in a root `.env.dev` (copy `.env.dev.example`; ask a maintainer for the values). Every dev script refuses to run if a value in `.env.dev` points at production.
- The old project `pvtgvraqbgncrexnkoof` is retired; don't use it.
- **Error monitoring** is Sentry, off unless a DSN is set (`NEXT_PUBLIC_SENTRY_DSN` on web, `EXPO_PUBLIC_SENTRY_DSN` in the app; `*_SENTRY_ENVIRONMENT` is `development` or `production`). Events carry the user id only (`scrubEvent` in `packages/shared/src/monitoring.ts`). Source-map upload runs only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set as build env vars on the web host / EAS. Those are secrets: never in a file. Report errors through `reportError()` in each app's `monitoring.ts`.

## Architecture rules

- **All data access goes through `packages/shared/src/api.ts`.** Each function takes a Supabase client, so web (server and browser) and mobile share the same queries and view models. Add a function there rather than writing ad-hoc queries in a screen.
- **Web pages** are Server Components. They load data with `const { sb, me } = await currentUser()` from `src/lib/supabase-server.ts`. Interactive parts are small `'use client'` components that write with `supabaseBrowser()` and then call `router.refresh()`.
- **Mobile screens** load with `useData(() => apiFn(supabase, …), deps)`, which refetches on focus and supports pull-to-refresh, and update optimistically.
- **Shared design values.**
  - Web uses the CSS variables from `apps/web/src/styles/broadsheet.css`, copied from the design tokens.
  - Mobile uses `colors`, `tone` and `tint` from `@dtour/shared` tokens.
  - On mobile, always render text with `<T>` (`src/components/T.tsx`). It maps weight and italic to the right Source Serif font file and handles em-based letter-spacing.
- **Icons.** Use `<Icon name="kebab-name" />`. Add every new icon on **both** platforms. Web: add it to `ICONS` in `scripts/gen-icons.mjs` (and to `FILL` if it switches to `weight="fill"`), then run `npm run icons`, which regenerates `apps/web/src/components/icon-paths.ts` with only the weights we draw (never edit that file; a unit test checks it). Mobile: add it to `apps/mobile/src/components/Icon.tsx` and to the type stub `apps/mobile/src/types/phosphor-icon.d.ts`; mobile uses per-icon deep imports to keep the bundle small.
- **Routes.**
  - Web: `/`, `/boards`, `/b/[slug]`, `/b/[slug]/[id]` (thread; `/t/[id]` redirects there), `/wiki`, `/wiki/[slug]`, `/library/[branch]/[sem]`, `/library/subject/[code]`, `/societies`, `/teams`, `/kahan-chalein`, `/new`, `/u/[handle]`, `/mod`, `/lounge`.
  - The database stores **web** routes, in search results, activity and notifications. Mobile converts them with `appRoute()` in `apps/mobile/src/lib/routes.ts`. Keep that mapping in sync when you add routes.
- **Search** is a server-side subsequence pre-filter (`public.search` RPC) followed by client re-ranking with `rank()` from `fuzzy.ts`. Keep the scoring identical to the prototype: +8 consecutive, +6 word start, +1 otherwise, a small length penalty.

## Access, auth and moderation rules

These are product decisions. Don't change them without asking.

- **Reading is public; anything that writes needs a signed-in DTU account.** RLS is the real gate: anon gets read-only access to content tables, and personal rows such as votes and saves are owner-only. In the UI, call `requireMe()` (web, from `useShell()`) or `useRequireMe()` (mobile) at the start of every write action, so visitors get sent to sign in.
- **Suspensions.** The one exception to the rule above: a moderator can suspend a member from writing for 1, 7 or 30 days or indefinitely, with a reason (`suspend_member` / `lift_suspension`, the `/mod` Suspensions section). Only admins suspend moderators or admins. A suspended member still reads and keeps private housekeeping (marking notifications read, saves, drafts, push tokens, `boards_seen_at`, leaving a team or society, deleting their own posts, downloads, export, account deletion). Every other write is refused by the `block_suspended` trigger with SQLSTATE `DT403` and the reason. When you add a table members write to, add it to that trigger's list in a new migration. In the UI, `requireMe()` shows the reason; pass `requireMe('own')` for housekeeping a suspension allows. The `suspensions` table is the log, readable by moderators and the member only. Deleting the account doesn't shed a suspension: the active one stays in the log (`user_id` null, `former_handle` set, shown as "@handle (account deleted)"), with only a SHA-256 of the normalised email in the private `suspension_carryovers` table, and applies again when that email signs up. It is dropped once lifted or ended.
- **Account deletion** (`delete_my_account`, the profile's Settings). Personal rows cascade from `profiles` (votes, saves, drafts, notifications, karma, badges, memberships, push tokens, teams they own, reports they filed). Threads, replies, Lounge messages, wiki edits and talk, places, society posts and library uploads stay with no author ("[deleted user]"). Images in the `media` bucket that nothing left on DTour uses are removed first through the Storage API (`my_unused_media()`, called by `deleteMyAccount()`), and the RPC refuses with `DT409` while any remain. Images still shown by kept content stay. When you add a column that can hold a media URL, add it to `media_references()`. The handle is released at once, and an active suspension is kept (see above). `export_my_data` returns the profile, threads, replies, votes and suspensions.
- **DTU only.** Sign-up is limited to `@dtu.ac.in` addresses. Three things enforce it: the `before_user_created` auth hook, a trigger on `auth.users`, and `public.allowed_email_domains`. Sign-in is Google (with a `hd=dtu.ac.in` hint) or a 6-digit email code. New profiles are pre-filled from the roll number in the email, then confirmed in onboarding.
- **Wiki moderation.** New guides start as `status = 'pending'` and edits as `wiki_revisions.status = 'suggested'`. They go live only when a moderator approves them, through the `review_wiki_article` / `review_wiki_revision` RPCs and the `/mod` queue. `ai_verdict` is reserved for a future AI pre-check. Roles live in `profiles.role` (`member` | `moderator` | `admin`) and can only be changed with SQL.
- **Session freshness.** `proxy.ts` and `getMe()` use `getClaims()` (local JWT check, no Auth round trip). With `jwt_expiry = 3600`, a revoked session or banned user can look signed in on public pages for up to an hour. `/new`, `/onboarding` and `/mod` call `getUser()` in `proxy.ts`, so they refuse it at once. Roles and deleted users are always fresh (`getMe()` reads `profiles` every request), and writes are gated by RLS on the JWT. If bans become a real tool, shorten `jwt_expiry` or extend the `getUser()` paths. Off asymmetric signing keys, `getClaims()` silently falls back to `getUser()`.
- **Counters and karma are maintained by triggers:** scores, reply counts, downloads, RSVPs, and karma (+10 per upvote received, +25 per accepted answer). Never write counters from client code; guard triggers reset them anyway.
- **Notifications are created by database triggers:** @mentions, replies, comments, grouped upvotes, accepted answers, team requests and wiki reviews. Clients only read them and mark them read. Realtime subscriptions on owner-only tables must call `supabase.realtime.setAuth(accessToken)` before subscribing, or RLS hides the rows.

## Database changes

- **Never edit a migration that is already applied.** Add a new file in `supabase/migrations/` with the next version number (`20261017000014_…`, then `…15_…`). Versions must be unique across all branches, so check other open branches before picking one.
- **CI checks migration versions** (`npm run check:migrations`, first step of the **check** job). It fails when a file name isn't `NNNNNNNNNNNNNN_snake_name.sql`, when two files share a version, when a migration your branch adds isn't newer than the newest one on `origin/main`, or when your branch edits, renames or deletes a migration that's already on main. The usual cause is another PR merging a migration first. **Fix it by renaming your file to the next free version** (the error suggests one; check other open PRs don't use it), then rerun `npm run check:migrations` after `git fetch origin main`. Never renumber a file that's already on main.
- **Each migration must include its RLS policies and grants.** Grant `select` to `anon` only for public content. Don't forget `revoke … from anon, authenticated` for internal `security definer` helpers.
- **Try migrations on dev first:** `npm run db:dev:reset` rebuilds the dev DB from all migration files, then `npm run test:db`.
- **Applying to production** happens after the PR is merged, done by a maintainer: `supabase db push` from an up-to-date `main` that has **every** applied migration file.
- **Never run `supabase db reset --linked`** or anything else that wipes the live project.
- **After a schema change, regenerate the shared types** from a fresh local stack (`npx supabase@3.1.0 start`, which applies every migration):
  `npm run db:types`
  It runs `supabase gen types typescript --local --schema public` with CLI 3.1.0 and formats the output with Prettier (defaults, no semicolons) into `packages/shared/src/database.types.ts`. **CI checks it:** the dev-db job runs `npm run db:types -- --check` and fails with a diff if the committed file doesn't match the migrations. Never hand-edit the file.
  To see what production has, `supabase gen types typescript --project-id megohwzcghnbfdzsaypz --schema public` still works, but the hosted generator's output differs in style, so don't commit it.
- **Demo content.** Rows from `seed.sql` are flagged `is_demo`. Notifications skip demo users, and `select public.dtour_clear_demo();` removes all demo content, and the dev test accounts at `@dtour.invalid`, before launch.

## Platform gotchas

- **Next.js 16 differs from older versions.**
  - Request-time APIs are async: `await params`, `await searchParams`, `await cookies()`.
  - Middleware is now `src/proxy.ts`, which refreshes the session and protects only `/new`, `/onboarding` and `/mod`.
  - `cacheComponents` is off on purpose: every page is per-user.
  - Check `node_modules/next/dist/docs/` before relying on memory.
- **Expo SDK 58 differs from older versions.**
  - Install dependencies with `npx expo install`.
  - Expo Router routes live in `src/app/`.
  - Tab screens must be declared in the tabs `_layout.tsx`.
  - Prefer `useRouter()`.
  - Fetch the versioned docs at `https://docs.expo.dev/versions/v58.0.0/` before using an API you're unsure about.
- **Expo Go limits.**
  - `npm run mobile` starts in Expo Go mode (`--go`). Expo Go can't load native modules that aren't bundled with it, such as `expo-notifications` on Android. Load those lazily behind `pushSupported` (see `src/lib/push.ts`). Never import them at the top level of anything on the startup path.
  - The Play Store copy of Expo Go may lag behind SDK 58. Testers may need the APK from expo-go-releases.
- **Native builds** go through EAS (`eas.json` has `development`, `preview` and `production` profiles). There's no local Xcode or Android SDK requirement.
- **Phone push** needs a development or store build. It also needs these one-off setup steps, documented in `README.md`: the `push` function deployed, a DB webhook on `notifications` inserts, and EAS push credentials.

## Git and pull requests

- **Remotes.** `origin` is the team repo, **`DTour-git/DTour`**, which is private. `KrishBnsl/DTour` is an old personal mirror.
- **Branches and PRs.** Work on a branch and open a PR into `main`. Don't push straight to `main`. Keep PRs focused, and say in the description what you checked and what you didn't.
- **Commits.** Use imperative subjects ("Add …", "Fix …") and explain the *why* in the body when it isn't obvious.
- **If a PR touches the database:** list the new migrations, say whether they're already applied to `megohwzcghnbfdzsaypz`, and give any manual steps (dashboard settings, function deploys, cron jobs).
- **Templates.** PRs use `.github/pull_request_template.md`; fill in every section. New work starts as an issue from the **Task** template, whose acceptance criteria define "done".
- **Formatting.** Prettier (`.prettierrc.json`). The whole repo is formatted and CI enforces it (`npm run format:check`). `npm run format` formats only the files your branch changed, so it never causes conflicts; run `npm run format:check` before pushing. Don't reformat unrelated files. To hide the one-off reformat from local blame: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Guardrails for Claude Code

`.claude/settings.json` is shared by the team:

- **Allowed without asking:** checks, tests, lint, format, read-only git and `gh pr` commands.
- **Always asks:** `git push`, `npm run db:dev:reset`, `npm run dev:login …` (it mints a live dev sign-in link), `supabase migration …`, `gh pr merge`.
- **Blocked:** `supabase db push`, `supabase db reset` without `--db-url`, `supabase link`, force pushes, pushing to `main`, `git reset --hard`, destructive commands that mention the production ref, and reading real `.env` files.
- **Hooks** (`.claude/hooks/`):
  - `guard-migrations.mjs` blocks edits to any migration already on `origin/main`.
  - `guard-bash.mjs` catches the blocked commands (and `supabase link`) even inside longer command lines, behind wrappers like `npx` or `npm exec`, in quoted words, in `sh -c`/`eval` scripts, in `$(…)`, and in heredocs fed to a shell. It also refuses any command that names a secret env file (`.env`, `.env.dev`, `.env.local`; the `.example` templates are fine). Commands only mentioned in prose (commit messages, PR bodies) still pass.
  - `typecheck-on-stop.mjs` runs `npm run typecheck` when Claude finishes with changed `.ts`/`.tsx` files, and sends any errors back so they get fixed.
- **The secret-file rules are advisory, not a boundary.** The test commands that run without asking execute repository code, and the test helpers read `.env.dev` on purpose. So anything that can change a test and run it can read the dev keys. That's why `.env.dev` must only ever hold **dev** project values (the dev scripts refuse production ones), and why production secrets never go in any file in the repo.
- Personal overrides go in `.claude/settings.local.json` (gitignored).

## Still open (as of Oct 2026)

- **Email codes** go out through Resend over custom SMTP (#65). The repo side is done: `[auth.email.smtp]` in `supabase/config.toml` (off for the local stack, so mail stays in Mailpit), the `otp.html` template, and the auth rate limits. The hosted side is manual and not yet done on production or dev. It covers the sending domain with SPF/DKIM/DMARC, the SMTP settings, templates and rate limits in each dashboard, and a test with a real `@dtu.ac.in` address. The steps are in README → "Email codes". The Resend API key lives only in Resend and the Supabase dashboard, never in the repo or any env file. `mail.dtour.example` in `config.toml` is a placeholder until the real domain is chosen.
- **Google sign-in** is configured on production (`megohwzcghnbfdzsaypz`) but not yet verified end-to-end with a real `@dtu.ac.in` account (redirect URLs, consent screen publishing). It is **not enabled on dev**, so test with email-code accounts there.
- **Phone push** isn't live yet: the `push` function isn't deployed, and there's no webhook or EAS credentials yet.
- **Branch protection** on `main` isn't possible on the GitHub Free plan for a private repo. Until the org upgrades (or the repo goes public), "PRs only" and CODEOWNERS reviews are a team rule, not enforced by GitHub.
