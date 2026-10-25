#!/usr/bin/env node
// Stop: if TypeScript files changed in the working tree, run the typecheck before
// Claude finishes. On failure, send the errors back so Claude fixes them.
import { execFileSync, spawnSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { stop_hook_active, cwd = process.cwd() } = JSON.parse(input || '{}');
if (stop_hook_active) process.exit(0); // already retried once; don't loop

let changed = '';
try {
  changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd, encoding: 'utf8' });
} catch {
  process.exit(0);
}
if (!/\.(ts|tsx)$/m.test(changed)) process.exit(0);

const r = spawnSync('npm', ['run', 'typecheck', '--silent'], { cwd, encoding: 'utf8' });
if (r.status === 0) process.exit(0);

const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
console.log(JSON.stringify({ decision: 'block', reason: `Typecheck failed. Fix these before finishing:\n${out}` }));
