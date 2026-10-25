// Prints a one-time sign-in link for a test account on the DEV project.
//   npm run dev:login                     → e2e.student on http://localhost:3000
//   npm run dev:login -- e2e.moderator    → the moderator test account
//   npm run dev:login -- aarav.k http://localhost:3100
// The website must be running against dev (npm run web:dev-db), or the link won't work.
import { loadDevEnv, fail } from './dev-env.mjs';

const env = loadDevEnv({ need: ['DEV_SUPABASE_URL', 'DEV_SUPABASE_SECRET_KEY'] });
const handle = process.argv[2] ?? 'e2e.student';
const base = process.argv[3] ?? 'http://localhost:3000';

export async function magicLinkHash(email) {
  const res = await fetch(`${env.DEV_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: env.DEV_SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.DEV_SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const body = await res.json();
  const hash = body.hashed_token ?? body.properties?.hashed_token;
  if (!hash) fail(`Could not create a sign-in link for ${email}: ${JSON.stringify(body)}`);
  return hash;
}

const hash = await magicLinkHash(`${handle}@dtour.invalid`);
console.log(`${base}/auth/confirm?token_hash=${hash}&type=magiclink`);
