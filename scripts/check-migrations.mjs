#!/usr/bin/env node
// Checks supabase/migrations so `supabase db push` on production never has to skip or reorder files.
// Usage: npm run check:migrations                 → names, unique versions, and the branch vs origin/main
//        node scripts/check-migrations.mjs --names-only   → names and unique versions only (pushes to main)
//        node scripts/check-migrations.mjs --base <ref>   → compare with another base than origin/main
// The rules live in checkMigrations() (pure, unit-tested); the rest only reads git and the file system.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = 'supabase/migrations';
export const NAME = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;

export const versionOf = (name) => NAME.exec(name)?.[1] ?? null;

const nextVersion = (v) => (BigInt(v) + 1n).toString().padStart(14, '0');

/**
 * @param {object} p
 * @param {Map<string, string>} p.head   migration file name → git blob id, as on this branch (working tree)
 * @param {Map<string, string>} [p.base] the same for the base branch (origin/main); omit for names-only
 * @param {Set<string>} [p.forkPoint]    file names at the merge base, to tell "deleted here" from "not merged in yet"
 * @returns {string[]} problems, empty when everything is fine
 */
export function checkMigrations({ head, base, forkPoint }) {
  const errors = [];
  const names = [...head.keys()].sort();

  for (const name of names) {
    if (!NAME.test(name)) {
      errors.push(`${DIR}/${name}: the name must look like NNNNNNNNNNNNNN_snake_name.sql (14-digit version, lowercase snake_case).`);
    }
  }

  const byVersion = new Map();
  for (const name of names) {
    const v = versionOf(name);
    if (v) byVersion.set(v, [...(byVersion.get(v) ?? []), name]);
  }
  for (const [v, files] of byVersion) {
    if (files.length > 1) errors.push(`Version ${v} is used by more than one file: ${files.join(', ')}. Each version must be unique.`);
  }

  if (!base) return errors;

  // Changing or deleting a merged migration: production may already have run it.
  for (const name of names) {
    if (base.has(name) && base.get(name) !== head.get(name)) {
      errors.push(`${DIR}/${name} is already on main, so it may already be applied. Revert the edit and add a new migration instead.`);
    }
  }
  for (const name of [...base.keys()].sort()) {
    if (!head.has(name) && (!forkPoint || forkPoint.has(name))) {
      errors.push(`${DIR}/${name} is already on main but this branch deletes or renames it. Restore it and add a new migration instead.`);
    }
  }

  // New files must sort after everything on main, or a plain `supabase db push` refuses them.
  const allVersions = [...base.keys(), ...names].map(versionOf).filter(Boolean).sort();
  const newestOnBase = [...base.keys()].map(versionOf).filter(Boolean).sort().at(-1);
  let next = allVersions.length ? nextVersion(allVersions.at(-1)) : null;
  for (const name of names) {
    const v = versionOf(name);
    if (!v || base.has(name) || !newestOnBase || v > newestOnBase) continue;
    const rest = name.slice(15);
    errors.push(
      `${DIR}/${name} is new on this branch, but its version ${v} is not newer than ${newestOnBase}, the newest on main. ` +
        `Rename it to ${next}_${rest} (check other open PRs don't use that version too).`,
    );
    next = nextVersion(next);
  }

  return errors;
}

// ---- git and file system ----

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

/** File name → blob id for the migrations in a commit. */
function treeAt(ref) {
  const out = git('ls-tree', `${ref}:${DIR}`);
  const files = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [meta, name] = line.split('\t');
    const [, type, blob] = meta.split(' ');
    if (type === 'blob') files.set(name, blob);
  }
  return files;
}

/** File name → blob id for the migrations in the working tree (tracked or new, not ignored). */
function workingTree() {
  const paths = git('ls-files', '--cached', '--others', '--exclude-standard', '--', DIR)
    .split('\n')
    .filter((p) => p && existsSync(p));
  const unique = [...new Set(paths)].sort();
  const blobs = unique.length ? git('hash-object', '--', ...unique).split('\n') : [];
  return new Map(unique.map((p, i) => [p.slice(DIR.length + 1), blobs[i]]));
}

function main(argv) {
  process.chdir(resolve(fileURLToPath(import.meta.url), '../..'));
  const namesOnly = argv.includes('--names-only');
  const baseIdx = argv.indexOf('--base');
  const baseRef = baseIdx >= 0 ? argv[baseIdx + 1] : 'origin/main';

  const head = workingTree();
  let base;
  let forkPoint;
  if (!namesOnly) {
    if (!tryGit('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`)) {
      console.error(
        `check-migrations: can't find ${baseRef}. Run \`git fetch origin main\` (in CI, check out with fetch-depth: 0), ` +
          'or pass --names-only to skip the branch checks.',
      );
      process.exit(1);
    }
    base = treeAt(baseRef);
    const mergeBase = tryGit('merge-base', 'HEAD', baseRef);
    forkPoint = mergeBase ? new Set(treeAt(mergeBase).keys()) : undefined;
  }

  const errors = checkMigrations({ head, base, forkPoint });
  if (errors.length) {
    console.error(`Migration check failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`);
    process.exit(1);
  }
  const scope = namesOnly ? 'names and versions' : `names, versions and changes vs ${baseRef}`;
  console.log(`Migrations OK: ${head.size} files (${scope}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
