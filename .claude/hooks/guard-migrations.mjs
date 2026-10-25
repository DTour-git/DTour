#!/usr/bin/env node
// PreToolUse (Edit|Write): block changes to migrations that are already on origin/main.
// Applied migrations must never be edited — add a new numbered migration instead.
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { tool_input = {}, cwd = process.cwd() } = JSON.parse(input || '{}');
const file = tool_input.file_path;
if (!file) process.exit(0);

const rel = relative(cwd, file).split('\\').join('/');
if (!/^supabase\/migrations\/.+\.sql$/.test(rel)) process.exit(0);

let onMain = false;
try {
  execFileSync('git', ['cat-file', '-e', `origin/main:${rel}`], { cwd, stdio: 'ignore' });
  onMain = true;
} catch {
  // not on origin/main (new migration) or no remote — allow
}

if (onMain) {
  console.error(
    `Blocked: ${rel} is already merged to main, so it may already be applied to the database.\n` +
      'Do not edit applied migrations. Create a new file instead: supabase/migrations/<next-number>_<name>.sql',
  );
  process.exit(2);
}
