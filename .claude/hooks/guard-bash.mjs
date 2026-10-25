#!/usr/bin/env node
// PreToolUse (Bash): block commands that could damage production or shared history.
// Backs up the deny rules in settings.json, which only match command prefixes.
// Only real commands are checked: heredoc bodies and quoted text (commit messages,
// PR descriptions) are ignored, so mentioning a command in prose is fine.
const PROD_REF = 'megohwzcghnbfdzsaypz';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const cmd = JSON.parse(input || '{}').tool_input?.command ?? '';

// Drop heredoc bodies: <<EOF … EOF, <<'EOF' … EOF, <<-"EOF" … EOF
const noHeredoc = cmd.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, '<<heredoc');
// Also drop quoted strings for the command-shape rules.
const code = noHeredoc.replace(/'[^']*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');

// A command starts at the beginning, or after ; & | ( newline or backtick.
const at = (body) => new RegExp(`(?:^|[;&|(\\n\`])\\s*(?:npx\\s+|sudo\\s+)?${body}`);

const rules = [
  [
    at('supabase\\s+db\\s+reset(?![^;&|\\n]*--db-url)'),
    code,
    'supabase db reset without --db-url would hit the linked PRODUCTION project. Use `npm run db:dev:reset`.',
  ],
  [
    at('supabase\\s+db\\s+push'),
    code,
    'supabase db push targets production. Migrations go to prod only after the PR is merged, by a human.',
  ],
  [
    new RegExp(`${PROD_REF}[^\\n]*\\b(reset|drop|truncate|delete)\\b|\\b(reset|drop|truncate|delete)\\b[^\\n]*${PROD_REF}`, 'i'),
    noHeredoc,
    'Destructive command mentions the production project ref.',
  ],
  [at('git\\s+push\\b[^;&|\\n]*(\\s-f\\b|--force(?!-with-lease))'), code, 'Force push is not allowed.'],
  [at('git\\s+push\\b[^;&|\\n]*\\s(\\S+\\s+)?(HEAD:)?main\\b'), code, 'Do not push to main directly. Open a pull request.'],
];

for (const [re, text, why] of rules) {
  if (re.test(text)) {
    console.error(`Blocked: ${why}`);
    process.exit(2);
  }
}
