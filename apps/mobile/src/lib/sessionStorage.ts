// Auth-session storage for the Supabase client: the session (refresh token,
// PKCE verifier) lives in the Keychain / Android Keystore instead of plaintext
// AsyncStorage. Kept free of React Native imports so it can be unit-tested.

/** The subset of expo-secure-store this adapter needs. */
export type SecureBackend = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** The subset of AsyncStorage this adapter needs: where sessions used to live. */
export type LegacyBackend = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

export type SessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Some platforms reject secure-store values above roughly 2 KB, and a Supabase
// session is usually larger, so values are split into chunks of at most this
// many UTF-8 bytes.
export const CHUNK_BYTES = 1800;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Splits `value` into pieces of at most `maxBytes` UTF-8 bytes, never inside a character. */
export function splitUtf8(value: string, maxBytes: number = CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of value) {
    const size = utf8Length(ch.codePointAt(0)!);
    if (bytes + size > maxBytes && current) {
      chunks.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  if (current || chunks.length === 0) chunks.push(current);
  return chunks;
}

export function createSessionStorage(secure: SecureBackend, legacy?: LegacyBackend): SessionStorage {
  async function readCount(key: string): Promise<number | null> {
    const raw = await secure.getItemAsync(countKey(key));
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  async function deleteChunks(key: string, from: number, to: number) {
    for (let i = from; i < to; i++) await secure.deleteItemAsync(chunkKey(key, i));
  }

  async function write(key: string, value: string) {
    const chunks = splitUtf8(value);
    const previous = (await readCount(key).catch(() => null)) ?? 0;
    // Chunks first, then the count, so a reader never sees a count whose
    // chunks are missing.
    for (let i = 0; i < chunks.length; i++) await secure.setItemAsync(chunkKey(key, i), chunks[i]);
    await secure.setItemAsync(countKey(key), String(chunks.length));
    await deleteChunks(key, chunks.length, previous);
  }

  async function dropLegacy(key: string) {
    await legacy?.removeItem(key).catch(() => {});
  }

  // Reads that fail are not cached, so the next read tries the store again.
  async function read(key: string): Promise<{ value: string | null; ok: boolean }> {
    let count: number | null;
    try {
      count = await readCount(key);
    } catch {
      // An unreadable entry (for example a Keystore key invalidated after a
      // lock-screen change) means the user signs in again.
      return { value: null, ok: false };
    }

    if (count === null) {
      // One-time move of a session saved by an older build.
      const old = legacy ? await legacy.getItem(key).catch(() => null) : null;
      if (old === null) return { value: null, ok: true };
      try {
        await write(key, old);
        await dropLegacy(key);
      } catch {
        // Keep the old copy until a later write succeeds, so the user stays signed in.
      }
      return { value: old, ok: true };
    }

    try {
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await secure.getItemAsync(chunkKey(key, i));
        if (part === null) return { value: null, ok: false };
        parts.push(part);
      }
      return { value: parts.join(''), ok: true };
    } catch {
      return { value: null, ok: false };
    }
  }

  // A value spans several secure-store entries, and the auth client takes no
  // lock around storage (every request reads the session, a refresh writes
  // it). So every operation that touches the store runs one at a time, and
  // reads are answered from memory once the value is known: a read never sees
  // half of a write.
  const cache = new Map<string, string | null>();
  let tail: Promise<unknown> = Promise.resolve();
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  }

  return {
    getItem(key) {
      if (cache.has(key)) return Promise.resolve(cache.get(key)!);
      return serial(async () => {
        if (cache.has(key)) return cache.get(key)!;
        const { value, ok } = await read(key);
        if (ok) cache.set(key, value);
        return value;
      });
    },

    setItem(key, value) {
      return serial(async () => {
        try {
          await write(key, value);
        } catch (e) {
          // The store may now hold part of the value: read it back next time.
          cache.delete(key);
          throw e;
        }
        cache.set(key, value);
        await dropLegacy(key);
      });
    },

    removeItem(key) {
      return serial(async () => {
        cache.delete(key);
        const count = (await readCount(key).catch(() => null)) ?? 0;
        await secure.deleteItemAsync(countKey(key));
        await deleteChunks(key, 0, count);
        cache.set(key, null);
        await dropLegacy(key);
      });
    },
  };
}
