#!/usr/bin/env node
// PreToolUse (Bash): block commands that could damage production or shared history.
// Backs up the deny rules in settings.json, which only match command prefixes.
//
// Prose is ignored, so mentioning a command in a commit message or PR body is
// fine: heredoc bodies and quoted strings with spaces in them are skipped. But
// quotes don't hide a command that would still run (#47):
//   - quoted single words are joined back, as the shell does: supabase "db" push
//   - the script given to sh/bash -c or eval is checked: bash -c "supabase db push"
//   - $(…) and `…` inside double quotes are checked: echo "$(supabase db push)"
//   - a heredoc fed to a shell is checked: bash <<EOF … EOF, cat <<EOF | sh
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROD_REF = 'megohwzcghnbfdzsaypz';

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)\n\s*\2\s*(?=\n|$)/g;
const QUOTED = /'[^']*'|"(?:\\.|[^"\\])*"/g;
// A shell as a command word (sh, bash, /bin/zsh), not part of a name like guard-bash.mjs or build.sh.
const SHELL = String.raw`(?:^|[\s;&|(\`])(?:[\w./-]*/)?(?:ba|z|da|k|fi)?sh(?=$|[\s;&|)\`])`;
// sh -c '…', bash -lc "…", eval '…': the quoted script runs.
const SCRIPT_ARG = new RegExp(String.raw`(?:${SHELL}(?:\s+-\w+)*?\s+-\w*c\w*|(?:^|[\s;&|(\`])eval)\s+('[^']*'|"(?:\\.|[^"\\])*")`, 'g');

/** The text of a quoted string, as the shell would pass it. */
const unquote = (q) => (q[0] === "'" ? q.slice(1, -1) : q.slice(1, -1).replace(/\\(["\\$`])/g, '$1'));

/** Every piece of shell that would run: the command itself and anything nested in it. */
function scripts(cmd, depth = 0) {
  const out = [];
  // Heredoc bodies are prose, unless the line feeds them to a shell.
  const top = cmd.replace(HEREDOC, (_m, _q, _tag, body, offset) => {
    const line = cmd.slice(cmd.lastIndexOf('\n', offset) + 1, offset + _m.indexOf('\n'));
    if (new RegExp(SHELL).test(shape(line)) && depth < 5) out.push(...scripts(body, depth + 1));
    return '<<heredoc';
  });
  out.push(top);
  if (depth >= 5) return out;
  // Quoted spans of the command itself: `sh -c '…'` mentioned inside one is prose.
  const spans = [...top.matchAll(QUOTED)].map((m) => [m.index, m.index + m[0].length]);
  const inQuotes = (i) => spans.some(([a, b]) => i > a && i < b);
  for (const m of top.matchAll(SCRIPT_ARG)) if (!inQuotes(m.index + 1)) out.push(...scripts(unquote(m[1]), depth + 1));
  for (const [q] of top.matchAll(QUOTED)) {
    if (q[0] !== '"') continue;
    const s = unquote(q);
    // $(…) (one level of nested parentheses) and `…` still run inside double quotes.
    for (const [, paren, tick] of s.matchAll(/\$\(((?:[^()]|\([^()]*\))*)\)|`([^`]*)`/g)) out.push(...scripts(paren ?? tick, depth + 1));
  }
  return out;
}

/** The command-shape view: prose (quoted text with spaces) dropped, quoted single words joined back. */
const shape = (s) => s.replace(QUOTED, (q) => (/\s/.test(unquote(q)) ? '""' : unquote(q)));

// A command starts at the beginning, or after ; & | ( newline or backtick.
const at = (body) => new RegExp(`(?:^|[;&|(\\n\`])\\s*(?:npx\\s+|sudo\\s+)?${body}`);
// supabase can also be reached through a wrapper (npx --yes, npm exec -- …, a path), so match it anywhere.
const sb = (body) => new RegExp(`(?:^|[\\s;&|(\\n\`/])supabase\\s+${body}`);

const rules = [
  [
    sb('db\\s+reset(?![^;&|\\n]*--db-url)'),
    'shape',
    'supabase db reset without --db-url would hit the linked PRODUCTION project. Use `npm run db:dev:reset`.',
  ],
  [sb('db\\s+push'), 'shape', 'supabase db push targets production. Migrations go to prod only after the PR is merged, by a human.'],
  [sb('link\\b'), 'shape', 'supabase link would repoint the CLI. It stays linked to production on purpose.'],
  [
    new RegExp(`${PROD_REF}[^\\n]*\\b(reset|drop|truncate|delete)\\b|\\b(reset|drop|truncate|delete)\\b[^\\n]*${PROD_REF}`, 'i'),
    'raw',
    'Destructive command mentions the production project ref.',
  ],
  [at('git\\s+push\\b[^;&|\\n]*(\\s-f\\b|--force(?!-with-lease))'), 'shape', 'Force push is not allowed.'],
  [at('git\\s+push\\b[^;&|\\n]*\\s(\\S+\\s+)?(HEAD:)?main\\b'), 'shape', 'Do not push to main directly. Open a pull request.'],
];

/** The reason `cmd` is blocked, or null. */
export function blocked(cmd) {
  for (const script of scripts(cmd)) {
    const views = { raw: script, shape: shape(script) };
    for (const [re, view, why] of rules) if (re.test(views[view])) return why;
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const why = blocked(JSON.parse(input || '{}').tool_input?.command ?? '');
  if (why) {
    console.error(`Blocked: ${why}`);
    process.exit(2);
  }
}
