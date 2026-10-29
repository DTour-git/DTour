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
npm test                   # unit tests only (Vitest), `npm run test:watch` while working
npm run test:db            # pgTAP tests in supabase/tests/database against the dev DB
npm run test:e2e           # Playwright tests in apps/web/e2e against the dev DB (builds and serves on :3100)
npm run db:dev:reset       # wipe and rebuild the DEV database: migrations + seed + test accounts
npm run dev:login -- e2e.student     # print a one-click sign-in link for a dev test account
npm run format             # Prettier on files your branch changed (never the whole repo)
```

**Before you call a change done**, run `npm run check`. If you changed SQL, also run `npm run test:db`; if you changed a web flow, also run `npm run test:e2e`. If you changed mobile code, also confirm it bundles: `cd apps/mobile && npx expo export --platform android --output-dir /tmp/x`.

CI (`.github/workflows/ci.yml`) runs two jobs on every PR and every push to `main`: **check** (typecheck, lints, unit tests, web build) and **dev-db** (database + browser tests against the dev project, using the `DEV_*` repository secrets; one run at a time).

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
- Copy each from the `.env.example` next to it. These files are gitignored. **Never commit them.**
- Apps only ever get the **publishable** key. The **secret** (service-role) key, database passwords and OAuth client secrets never go in the repo, in app env files, or in client code.
- **Two Supabase projects:**
  - **Production: `megohwzcghnbfdzsaypz`.** The real site. The CLI link (`supabase/.temp`) points here. Never write test data to it.
  - **Dev: `cqdqfmejbwvumbbclkfk`** (`dtour-dev`). Same migrations, demo seed and two test accounts. Use it for tests, experiments and agent work. Its keys go in a root `.env.dev` (copy `.env.dev.example`; ask a maintainer for the values). Every dev script refuses to run if a value in `.env.dev` points at production.
- The old project `pvtgvraqbgncrexnkoof` is retired; don't use it.

## Architecture rules

- **All data access goes through `packages/shared/src/api.ts`.** Each function takes a Supabase client, so web (server and browser) and mobile share the same queries and view models. Add a function there rather than writing ad-hoc queries in a screen.
- **Web pages** are Server Components. They load data with `const { sb, me } = await currentUser()` from `src/lib/supabase-server.ts`. Interactive parts are small `'use client'` components that write with `supabaseBrowser()` and then call `router.refresh()`.
- **Mobile screens** load with `useData(() => apiFn(supabase, …), deps)`, which refetches on focus and supports pull-to-refresh, and update optimistically.
- **Shared design values.**
  - Web uses the CSS variables from `apps/web/src/styles/broadsheet.css`, copied from the design tokens.
  - Mobile uses `colors`, `tone` and `tint` from `@dtour/shared` tokens.
  - On mobile, always render text with `<T>` (`src/components/T.tsx`). It maps weight and italic to the right Source Serif font file and handles em-based letter-spacing.
- **Icons.** Use `<Icon name="kebab-name" />`. Add every new icon in **both** maps: `apps/web/src/components/Icon.tsx` and `apps/mobile/src/components/Icon.tsx`. For mobile, also add it to the type stub `apps/mobile/src/types/phosphor-icon.d.ts`; mobile uses per-icon deep imports to keep the bundle small.
- **Routes.**
  - Web: `/`, `/boards`, `/b/[slug]`, `/b/[slug]/[id]` (thread; `/t/[id]` redirects there), `/wiki`, `/wiki/[slug]`, `/library/[branch]/[sem]`, `/library/subject/[code]`, `/societies`, `/teams`, `/kahan-chalein`, `/new`, `/u/[handle]`, `/mod`, `/lounge`.
  - The database stores **web** routes, in search results, activity and notifications. Mobile converts them with `appRoute()` in `apps/mobile/src/lib/routes.ts`. Keep that mapping in sync when you add routes.
- **Search** is a server-side subsequence pre-filter (`public.search` RPC) followed by client re-ranking with `rank()` from `fuzzy.ts`. Keep the scoring identical to the prototype: +8 consecutive, +6 word start, +1 otherwise, a small length penalty.

## Access, auth and moderation rules

These are product decisions. Don't change them without asking.

- **Reading is public; anything that writes needs a signed-in DTU account.** RLS is the real gate: anon gets read-only access to content tables, and personal rows such as votes and saves are owner-only. In the UI, call `requireMe()` (web, from `useShell()`) or `useRequireMe()` (mobile) at the start of every write action, so visitors get sent to sign in.
- **DTU only.** Sign-up is limited to `@dtu.ac.in` addresses. Three things enforce it: the `before_user_created` auth hook, a trigger on `auth.users`, and `public.allowed_email_domains`. Sign-in is Google (with a `hd=dtu.ac.in` hint) or a 6-digit email code. New profiles are pre-filled from the roll number in the email, then confirmed in onboarding.
- **Wiki moderation.** New guides start as `status = 'pending'` and edits as `wiki_revisions.status = 'suggested'`. They go live only when a moderator approves them, through the `review_wiki_article` / `review_wiki_revision` RPCs and the `/mod` queue. `ai_verdict` is reserved for a future AI pre-check. Roles live in `profiles.role` (`member` | `moderator` | `admin`) and can only be changed with SQL.
- **Counters and karma are maintained by triggers:** scores, reply counts, downloads, RSVPs, and karma (+10 per upvote received, +25 per accepted answer). Never write counters from client code; guard triggers reset them anyway.
- **Notifications are created by database triggers:** @mentions, replies, comments, grouped upvotes, accepted answers, team requests and wiki reviews. Clients only read them and mark them read. Realtime subscriptions on owner-only tables must call `supabase.realtime.setAuth(accessToken)` before subscribing, or RLS hides the rows.

## Database changes

- **Never edit a migration that is already applied.** Add a new file in `supabase/migrations/` with the next version number (`20261017000014_…`, then `…15_…`). Versions must be unique across all branches, so check other open branches before picking one.
- **Each migration must include its RLS policies and grants.** Grant `select` to `anon` only for public content. Don't forget `revoke … from anon, authenticated` for internal `security definer` helpers.
- **Try migrations on dev first:** `npm run db:dev:reset` rebuilds the dev DB from all migration files, then `npm run test:db`.
- **Applying to production** happens after the PR is merged, done by a maintainer: `supabase db push` from an up-to-date `main` that has **every** applied migration file.
- **Never run `supabase db reset --linked`** or anything else that wipes the live project.
- **After a schema change, regenerate the shared types:**
  `supabase gen types typescript --project-id megohwzcghnbfdzsaypz --schema public > packages/shared/src/database.types.ts`
- **Demo content.** Rows from `seed.sql` are flagged `is_demo`. Notifications skip demo users, and `select public.dtour_clear_demo();` removes all demo content before launch.

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
- **Formatting.** Prettier (`.prettierrc.json`). `npm run format` only touches files your branch changed, so it never causes conflicts. Don't reformat unrelated files.

## Guardrails for Claude Code

`.claude/settings.json` is shared by the team:

- **Allowed without asking:** checks, tests, lint, format, read-only git and `gh pr` commands.
- **Always asks:** `git push`, `npm run db:dev:reset`, `supabase migration …`, `gh pr merge`.
- **Blocked:** `supabase db push`, `supabase db reset` without `--db-url`, `supabase link`, force pushes, pushing to `main`, `git reset --hard`, destructive commands that mention the production ref, and reading real `.env` files.
- **Hooks** (`.claude/hooks/`):
  - `guard-migrations.mjs` blocks edits to any migration already on `origin/main`.
  - `guard-bash.mjs` catches the blocked commands even inside longer command lines.
  - `typecheck-on-stop.mjs` runs `npm run typecheck` when Claude finishes with changed `.ts`/`.tsx` files, and sends any errors back so they get fixed.
- Personal overrides go in `.claude/settings.local.json` (gitignored).

## Still open (as of Oct 2026)

- **Email codes** need a custom SMTP provider. Supabase's default mailer only delivers to project members, and the free tier blocks the template edit that puts the 6-digit `{{ .Token }}` in the email. The template is ready in `supabase/templates/otp.html`.
- **Google sign-in** is configured on production (`megohwzcghnbfdzsaypz`) but not yet verified end-to-end with a real `@dtu.ac.in` account (redirect URLs, consent screen publishing). It is **not enabled on dev**, so test with email-code accounts there.
- **Phone push** isn't live yet: the `push` function isn't deployed, and there's no webhook or EAS credentials yet.
- **Branch protection** on `main` isn't possible on the GitHub Free plan for a private repo. Until the org upgrades (or the repo goes public), "PRs only" and CODEOWNERS reviews are a team rule, not enforced by GitHub.
