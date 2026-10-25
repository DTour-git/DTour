#!/usr/bin/env node
// PreToolUse (Bash): block commands that could damage production or shared history.
// Backs up the deny rules in settings.json, which only match command prefixes.
const PROD_REF = 'megohwzcghnbfdzsaypz';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const cmd = JSON.parse(input || '{}').tool_input?.command ?? '';

const rules = [
  [
    /supabase\s+db\s+reset(?![^;&|]*--db-url)/,
    'supabase db reset without --db-url would hit the linked PRODUCTION project. Use `npm run db:dev:reset`.',
  ],
  [/supabase\s+db\s+push/, 'supabase db push targets production. Migrations go to prod only after the PR is merged, by a human.'],
  [
    new RegExp(`${PROD_REF}[^\\n]*(reset|drop|truncate|delete)|(reset|drop|truncate|delete)[^\\n]*${PROD_REF}`, 'i'),
    'Destructive command mentions the production project ref.',
  ],
  [/git\s+push\b[^\n]*(\s-f\b|--force(?!-with-lease))/, 'Force push is not allowed.'],
  [/git\s+push\b[^\n]*\s(origin\s+)?(HEAD:)?main\b/, 'Do not push to main directly. Open a pull request.'],
];

for (const [re, why] of rules) {
  if (re.test(cmd)) {
    console.error(`Blocked: ${why}`);
    process.exit(2);
  }
}
