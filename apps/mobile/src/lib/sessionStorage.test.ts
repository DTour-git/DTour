import { describe, expect, it } from 'vitest';
import { CHUNK_BYTES, createSessionStorage, splitUtf8, type LegacyBackend, type SecureBackend } from './sessionStorage';

const KEY = 'sb-cqdqfmejbwvumbbclkfk-auth-token';

function memorySecure(opts: { maxBytes?: number } = {}) {
  const map = new Map<string, string>();
  const backend: SecureBackend = {
    async getItemAsync(k) {
      return map.get(k) ?? null;
    },
    async setItemAsync(k, v) {
      // Same key rule as expo-secure-store.
      if (!/^[\w.-]+$/.test(k)) throw new Error(`invalid key ${k}`);
      if (opts.maxBytes && Buffer.byteLength(v, 'utf8') > opts.maxBytes) throw new Error('value too large');
      map.set(k, v);
    },
    async deleteItemAsync(k) {
      map.delete(k);
    },
  };
  return { map, backend };
}

function memoryLegacy(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const backend: LegacyBackend = {
    async getItem(k) {
      return map.get(k) ?? null;
    },
    async removeItem(k) {
      map.delete(k);
    },
  };
  return { map, backend };
}

// A realistic session: a few KB of JSON including a non-ASCII name.
const session = JSON.stringify({
  access_token: 'a'.repeat(1200),
  refresh_token: 'r'.repeat(40),
  user: { email: 'student@dtu.ac.in', user_metadata: { full_name: 'आरव कुमार 🎓'.repeat(60) } },
});

describe('splitUtf8', () => {
  it('keeps every chunk under the byte limit without splitting characters', () => {
    const chunks = splitUtf8(session);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(Buffer.byteLength(c, 'utf8')).toBeLessThanOrEqual(CHUNK_BYTES);
    expect(chunks.join('')).toBe(session);
  });

  it('returns one empty chunk for an empty string', () => {
    expect(splitUtf8('')).toEqual(['']);
  });
});

describe('createSessionStorage', () => {
  it('round-trips a large session through a store that rejects values over 2 KB', async () => {
    const secure = memorySecure({ maxBytes: 2048 });
    const storage = createSessionStorage(secure.backend);
    await storage.setItem(KEY, session);
    expect(await storage.getItem(KEY)).toBe(session);
  });

  it('removes stale chunks when a shorter value replaces a longer one', async () => {
    const secure = memorySecure();
    const storage = createSessionStorage(secure.backend);
    await storage.setItem(KEY, session);
    await storage.setItem(KEY, 'short');
    expect(await storage.getItem(KEY)).toBe('short');
    expect([...secure.map.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.n`]);
  });

  it('deletes every entry on removeItem', async () => {
    const secure = memorySecure();
    const storage = createSessionStorage(secure.backend);
    await storage.setItem(KEY, session);
    await storage.removeItem(KEY);
    expect(secure.map.size).toBe(0);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('returns null for a missing key and for a partially written value', async () => {
    const secure = memorySecure();
    const storage = createSessionStorage(secure.backend);
    expect(await storage.getItem(KEY)).toBeNull();
    await storage.setItem(KEY, session);
    secure.map.delete(`${KEY}.1`);
    expect(await createSessionStorage(secure.backend).getItem(KEY)).toBeNull();
  });

  it('moves a plaintext session from AsyncStorage into the secure store and deletes the old copy', async () => {
    const secure = memorySecure();
    const legacy = memoryLegacy({ [KEY]: session });
    const storage = createSessionStorage(secure.backend, legacy.backend);
    expect(await storage.getItem(KEY)).toBe(session);
    expect(legacy.map.has(KEY)).toBe(false);
    expect(secure.map.get(`${KEY}.n`)).toBeDefined();
    expect(await storage.getItem(KEY)).toBe(session);
  });

  it('never leaves a plaintext copy behind after setItem or removeItem', async () => {
    const secure = memorySecure();
    const legacy = memoryLegacy({ [KEY]: 'old', [`${KEY}-code-verifier`]: 'verifier' });
    const storage = createSessionStorage(secure.backend, legacy.backend);
    await storage.setItem(KEY, session);
    await storage.removeItem(`${KEY}-code-verifier`);
    expect(legacy.map.size).toBe(0);
  });

  it('never returns half of a write when reads and a refresh overlap', async () => {
    // Writes take a timer tick each (as Keychain writes are slow); reads are
    // quick, so a read can land between two chunk writes.
    const map = new Map<string, string>();
    const tick = () => new Promise((r) => setTimeout(r, 1));
    const slow: SecureBackend = {
      getItemAsync: async (k) => map.get(k) ?? null,
      setItemAsync: async (k, v) => void (await tick(), map.set(k, v)),
      deleteItemAsync: async (k) => void (await tick(), map.delete(k)),
    };
    const before = JSON.stringify({ refresh_token: 'old', pad: 'o'.repeat(5000) });
    const after = JSON.stringify({ refresh_token: 'new', pad: 'n'.repeat(5000) });
    await createSessionStorage(slow).setItem(KEY, before);

    // A fresh instance, as on app start: nothing cached yet.
    const storage = createSessionStorage(slow);
    const reads = Array.from({ length: 30 }, (_, i) => new Promise((r) => setTimeout(r, i)).then(() => storage.getItem(KEY)));
    const write = storage.setItem(KEY, after);
    const seen = await Promise.all(reads);
    await write;

    for (const v of seen) expect([before, after]).toContain(v);
    expect(await storage.getItem(KEY)).toBe(after);
    expect(await createSessionStorage(slow).getItem(KEY)).toBe(after);
  });

  it('does not cache a failed read', async () => {
    let fail = true;
    const secure = memorySecure();
    await createSessionStorage(secure.backend).setItem(KEY, session);
    const storage = createSessionStorage({
      ...secure.backend,
      getItemAsync: (k) => (fail ? Promise.reject(new Error('locked')) : secure.backend.getItemAsync(k)),
    });
    expect(await storage.getItem(KEY)).toBeNull();
    fail = false;
    expect(await storage.getItem(KEY)).toBe(session);
  });

  it('treats an unreadable secure store as signed out', async () => {
    const storage = createSessionStorage({
      getItemAsync: () => Promise.reject(new Error('keystore key invalidated')),
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    });
    expect(await storage.getItem(KEY)).toBeNull();
  });
});

describe('app.json', () => {
  it('keeps app data (and so any session) out of Android backups', async () => {
    const { default: app } = await import('../../app.json');
    expect(app.expo.android.allowBackup).toBe(false);
  });
});
