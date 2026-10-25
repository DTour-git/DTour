// Runs a command with the apps pointed at the DEV Supabase project instead of production.
//   node scripts/with-dev-db.mjs npm run web
import { spawn } from 'node:child_process';
import { loadDevEnv, fail } from './dev-env.mjs';

const env = loadDevEnv({ need: ['DEV_SUPABASE_URL', 'DEV_SUPABASE_PUBLISHABLE_KEY'] });
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) fail('Usage: node scripts/with-dev-db.mjs <command> [...args]');
console.log(`→ using dev Supabase: ${env.DEV_SUPABASE_URL}`);
const child = spawn(cmd, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: env.DEV_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.DEV_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SUPABASE_URL: env.DEV_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.DEV_SUPABASE_PUBLISHABLE_KEY,
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
