import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blocked } from '../.claude/hooks/guard-bash.mjs';

const HOOK = fileURLToPath(new URL('../.claude/hooks/guard-bash.mjs', import.meta.url));

// #47: a blocked command can't hide in quotes, a nested shell or a wrapper,
// while commands only mentioned in prose (commit messages, PR bodies) still pass.
describe('guard-bash blocks', () => {
  it.each([
    ['supabase db push'],
    ['npx supabase db push'],
    ['npx --yes supabase db push'],
    ['npm exec --yes --package=supabase@3.1.0 -- supabase db push --linked'],
    ['./node_modules/.bin/supabase db push'],
    ['bash -c "supabase db push"'],
    ["sh -c 'supabase db push --linked'"],
    ['zsh -lc "cd supabase && supabase db push"'],
    ['eval "supabase db push"'],
    ['supabase "db" push'],
    ["supa'base' db 'push'"],
    ['echo "$(supabase db push)"'],
    ['echo "`supabase db push`"'],
    ["bash <<'EOF'\nsupabase db push\nEOF"],
    ['cat <<EOF | sh\nsupabase db push\nEOF'],
    ['/bin/bash <<EOF\nsupabase db push\nEOF'],
    ['bash -c "bash -c \\"supabase db push\\""'],
    ['supabase db reset'],
    ["bash -c 'supabase db reset --linked'"],
    ['supabase link --project-ref abc'],
    ['git push --force origin feat'],
    ['git "push" -f origin feat'],
    ['git push origin main'],
    ['git push origin "main"'],
    ['bash -c "git push origin HEAD:main"'],
    ['psql "$URL" -c "drop table x" # megohwzcghnbfdzsaypz'],
  ])('%j', (cmd) => {
    expect(blocked(cmd)).toBeTruthy();
  });
});

describe('guard-bash allows', () => {
  it.each([
    ['git status'],
    ['supabase db reset --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres'],
    ['npm exec --yes --package=supabase@3.1.0 -- supabase start --exclude studio'],
    ['npm run db:dev:reset'],
    ['git push -u origin feature/x'],
    ['git push --force-with-lease origin feature/x'],
    ['git commit -m "Never run supabase db push from a branch"'],
    ["echo 'supabase db push is for maintainers'"],
    ['gh pr create --title "Fix" --body "After merge: supabase db push from main"'],
    ["git commit -q -F - <<'EOF'\nApply with supabase db push after merge.\nEOF"],
    ["gh pr create --body-file - <<'EOF'\n1. `supabase db push` from an up-to-date main\nEOF"],
    ['echo "$(git rev-parse HEAD)"'],
    ['bash -c "npm run check"'],
    // "bash" inside a file name, and sh -c only mentioned in prose, are not shells.
    ["node .claude/hooks/guard-bash.mjs > out; cat > t.mjs <<'EOF'\nconst c = [\"sh -c 'supabase db push'\"];\nEOF"],
    ['git commit -m "Never use sh -c \'supabase db push\' either"'],
    ["git commit -F - <<'EOF'\nbash -c 'supabase db push' is blocked now.\nEOF"],
  ])('%j', (cmd) => {
    expect(blocked(cmd)).toBeNull();
  });
});

describe('the hook as Claude Code runs it', () => {
  const run = (command: string) =>
    spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' });

  it('exits 2 with the reason for a blocked command', () => {
    const r = run('bash -c "supabase db push"');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('supabase db push targets production');
  });

  it('exits 0 for an allowed command', () => {
    expect(run('git status').status).toBe(0);
  });
});
