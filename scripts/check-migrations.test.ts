import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkMigrations, versionOf } from './check-migrations.mjs';

// #119: migrations must be well named, unique, and newer than main so `supabase db push` never skips one.
const files = (...entries: (string | [string, string])[]) => new Map(entries.map((e) => (typeof e === 'string' ? [e, `blob-of-${e}`] : e)));

const MAIN = ['20261017000043_society_management.sql', '20261017000044_suspensions.sql'];

describe('checkMigrations', () => {
  it('passes a branch that adds the next version', () => {
    const head = files(...MAIN, '20261017000045_search_narrow_first.sql');
    expect(checkMigrations({ head, base: files(...MAIN), forkPoint: new Set(MAIN) })).toEqual([]);
  });

  it('passes a branch with no migration changes', () => {
    expect(checkMigrations({ head: files(...MAIN), base: files(...MAIN), forkPoint: new Set(MAIN) })).toEqual([]);
  });

  it('allows gaps in the numbering', () => {
    const head = files('20261017000013_a.sql', '20261017000015_b.sql');
    expect(checkMigrations({ head })).toEqual([]);
  });

  it('rejects a new version at or below the newest on main, and suggests the next free one', () => {
    const head = files(...MAIN, '20261017000040_late.sql', '20261017000044_clash.sql', '20261017000046_ok.sql');
    const errors = checkMigrations({ head, base: files(...MAIN), forkPoint: new Set(MAIN) });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain('Version 20261017000044 is used by more than one file');
    expect(errors[1]).toContain('20261017000040_late.sql is new on this branch');
    expect(errors[1]).toContain('Rename it to 20261017000047_late.sql');
    expect(errors[2]).toContain('Rename it to 20261017000048_clash.sql');
  });

  it('rejects duplicate versions, also in names-only mode', () => {
    const head = files('20261017000045_a.sql', '20261017000045_b.sql');
    expect(checkMigrations({ head })).toEqual([
      'Version 20261017000045 is used by more than one file: 20261017000045_a.sql, 20261017000045_b.sql. Each version must be unique.',
    ]);
  });

  it.each([
    '2026101700045_short.sql',
    '20261017000045-dash.sql',
    '20261017000045_CamelCase.sql',
    '20261017000045_trailing_.sql',
    '20261017000045__double.sql',
    '20261017000045_no_extension',
    '20261017000045_notes.txt',
    'README.md',
  ])('rejects the badly named file %s', (name) => {
    const [error] = checkMigrations({ head: files(name) });
    expect(error).toContain(`supabase/migrations/${name}: the name must look like NNNNNNNNNNNNNN_snake_name.sql`);
  });

  it('rejects editing a migration that is on main', () => {
    const head = files(MAIN[0], [MAIN[1], 'edited-blob']);
    expect(checkMigrations({ head, base: files(...MAIN), forkPoint: new Set(MAIN) })).toEqual([
      'supabase/migrations/20261017000044_suspensions.sql is already on main, so it may already be applied. Revert the edit and add a new migration instead.',
    ]);
  });

  it('rejects deleting or renaming a migration that is on main', () => {
    const head = files(MAIN[0], '20261017000045_suspensions_v2.sql');
    const errors = checkMigrations({ head, base: files(...MAIN), forkPoint: new Set(MAIN) });
    expect(errors).toEqual([
      'supabase/migrations/20261017000044_suspensions.sql is already on main but this branch deletes or renames it. Restore it and add a new migration instead.',
    ]);
  });

  it('does not treat migrations merged to main after the branch forked as deleted', () => {
    const base = files(...MAIN, '20261017000045_from_another_pr.sql');
    expect(checkMigrations({ head: files(...MAIN), base, forkPoint: new Set(MAIN) })).toEqual([]);
  });

  it('flags a branch that is behind main and reuses a version main now has', () => {
    const base = files(...MAIN, '20261017000045_from_another_pr.sql');
    const head = files(...MAIN, '20261017000045_mine.sql');
    const [error] = checkMigrations({ head, base, forkPoint: new Set(MAIN) });
    expect(error).toContain('Rename it to 20261017000046_mine.sql');
  });

  it('skips the branch checks in names-only mode', () => {
    expect(checkMigrations({ head: files('20261017000001_schema.sql', '20261017000041_late.sql') })).toEqual([]);
  });
});

describe('versionOf', () => {
  it('reads the 14-digit version, or null for a bad name', () => {
    expect(versionOf('20261017000044_suspensions.sql')).toBe('20261017000044');
    expect(versionOf('44_suspensions.sql')).toBeNull();
  });
});

it('CI runs the check with the full history it needs to find origin/main', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const check = workflow.slice(workflow.indexOf('\n  check:'), workflow.indexOf('\n  dev-db:'));
  expect(check).toContain('fetch-depth: 0');
  expect(check).toContain('scripts/check-migrations.mjs');
});
