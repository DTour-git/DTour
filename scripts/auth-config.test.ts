import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// #30: DTour signs in with Google or a 6-digit email code, never a password.
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');

/** The value of `key` inside `[section]` of the TOML file, ignoring comments. */
function setting(section: string, key: string): string | undefined {
  let current = '';
  for (const raw of config.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) current = header[1];
    else if (current === section) {
      const kv = line.match(/^([\w.]+)\s*=\s*(.+)$/);
      if (kv && kv[1] === key) return kv[2].trim();
    }
  }
  return undefined;
}

test('a sign-up must confirm it owns the mailbox', () => {
  expect(setting('auth.email', 'enable_confirmations')).toBe('true');
});

test('new students can still sign up with an email code', () => {
  expect(setting('auth', 'enable_signup')).toBe('true');
  expect(setting('auth.email', 'enable_signup')).toBe('true');
  expect(setting('auth.email', 'otp_length')).toBe('6');
});

test('the confirmation email carries the code, like the sign-in email', () => {
  for (const kind of ['magic_link', 'confirmation']) {
    const path = setting(`auth.email.template.${kind}`, 'content_path');
    expect(path).toBe('"./supabase/templates/otp.html"');
  }
  expect(readFileSync(new URL('../supabase/templates/otp.html', import.meta.url), 'utf8')).toContain('{{ .Token }}');
});
