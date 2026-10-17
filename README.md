# DTour

The campus, all in one place. A community platform for DTU students: campus news, boards, a student wiki, a notes/PYQ library, the society board, Team Up, Kahan chalein? and the Lounge (a live chat).

| | |
|---|---|
| `apps/web` | Website. Next.js 16 (App Router) with the Broadsheet CSS tokens |
| `apps/mobile` | iOS + Android app. Expo SDK 58, React Native, Expo Router |
| `packages/shared` | Shared code: design tokens, data API, fzf-style fuzzy search, formatting, markdown, generated DB types |
| `supabase/` | Postgres schema, RLS, triggers, auth hook and demo seed |
| `design_handoff_dtour/` | Design source of truth: prototypes, tokens and screenshots |

## Running locally

```bash
npm install
npm run web        # http://localhost:3000
npm run mobile     # Expo dev server: scan the QR code with Expo Go, or press w for web
```

Environment files are gitignored. Copy the examples and fill them in from the Supabase dashboard (Project Settings → API keys):

- `apps/web/.env.local`: copy from `apps/web/.env.example`
- `apps/mobile/.env`: copy from `apps/mobile/.env.example`

## Backend (Supabase)

- **Project:** `dtour` (ref `pvtgvraqbgncrexnkoof`), region ap-south-1 (Mumbai).
- **Schema:** `supabase/migrations`. Apply it with `supabase db push`.
- **Demo content:** `supabase/seed.sql` holds all the copy from the prototypes. Every seeded row is flagged `is_demo`. To remove it before launch, run `select public.dtour_clear_demo();` in the SQL editor.
- **Counters:** reply counts, scores, karma, downloads and RSVPs are kept current by triggers. Karma is +10 per upvote received and +25 for an accepted answer.
- **Search:** the server pre-filters with a subsequence regex (`public.search`), and the client re-ranks results fzf-style (`packages/shared/src/fuzzy.ts`).
- **Realtime:** Lounge messages use Postgres changes. "N online" counts come from a presence channel shared by the website and the app.

### Access, moderation, notifications

- **Reading is public.** Anyone can browse. Posting, replying, voting, RSVPs, the Lounge composer, uploads and downloads need a DTU account. This is enforced by RLS (anon gets read-only access to content tables) and by sign-in prompts in both apps.
- **Wiki moderation.** New guides (`status = 'pending'`) and edits (`status = 'suggested'`) wait in the moderation queue (`/mod` on the website) until a moderator approves them. Authors are notified either way. The `ai_verdict` column is reserved for a future AI pre-check.
- **Making someone a moderator:** run `update public.profiles set role = 'moderator' where handle = '<handle>';` (or `'admin'`). Members can't change their own role.
- **Notifications** (the bell): @mentions in the Lounge, threads and replies; replies to your threads; replies to your comments; upvotes (grouped per post); accepted answers; team join requests; wiki review results. They arrive live over Supabase Realtime.
- **Reply preference:** the composer checkbox controls reply alerts per thread. This uses `notify_on_reply` from migration `20261017000010_reply_preferences.sql`.
- **Drafts:** both composers save and reopen drafts from your profile. Publishing removes the saved draft.
- **Event reminders:** society events with a start date can notify students who RSVP about 30 minutes before the event. Migration `20261017000009_event_reminders.sql` provides the idempotent reminder job.

### Auth: DTU accounts only

- **Who can sign up:** only `@dtu.ac.in` addresses. This is enforced server-side by the `before_user_created` auth hook, plus a trigger on `auth.users`. The allowed domains live in `public.allowed_email_domains`.
- **Sign-in methods:** Google sign-in (restricted to the DTU domain), or a 6-digit email code. The code lets students read their DTU mail on another device and type it on their phone.
- **Profile setup:** each new profile is pre-filled from the roll number in the email address, e.g. `name_2k23co123@dtu.ac.in` gives branch COE, batch '27 and the current semester. Onboarding lets the student confirm or correct these.

## Mobile builds

There is no Xcode or Android SDK on this machine, so builds go through EAS: `npx eas-cli@latest build`. Expo Go works for day-to-day development.

Phone push requires a development or preview build, an EAS project ID, and iOS/Android push credentials. The app registers a device token after the student enables alerts in Settings; the `push` Edge Function sends new in-app notifications to those devices. To activate it later:

1. Apply all migrations, including `20261017000007_push_tokens.sql`.
2. Run `npx eas-cli@latest init` in `apps/mobile` to set `extra.eas.projectId` in `app.json`. Configure Android FCM v1 and Apple push credentials in EAS, then build with `npx eas-cli@latest build --profile development` (or `preview`).
3. Deploy the function with `supabase functions deploy push`. If Expo enhanced push security is enabled, set `EXPO_ACCESS_TOKEN` as a Supabase function secret.
4. In Supabase Database Webhooks, create a webhook for `INSERT` on `public.notifications` targeting the `push` function. Add an `apikey` header holding a **secret** Supabase API key; the function uses secret-key authentication. Do not put that key in the app or web environment files.
5. Sign in on the built app, open Settings, and choose **Enable phone alerts**. Test delivery with a reply or mention.

For RSVP event reminders, enable `pg_cron` in Supabase and schedule `select public.enqueue_event_reminders();` every 15 minutes. For example, in the SQL editor: `select cron.schedule('dtour-event-reminders', '*/15 * * * *', 'select public.enqueue_event_reminders()');`. Event posts need a start date for this job to find them.

Google OAuth client creation, the email-code sender, assigning moderator accounts, applying migrations to the live project, and EAS credential/build setup require your service accounts. The code and local configuration do not perform those account changes.
