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

  return {
    async getItem(key) {
      let count: number | null;
      try {
        count = await readCount(key);
      } catch {
        // An unreadable entry (for example a Keystore key invalidated after a
        // lock-screen change) means the user signs in again.
        return null;
      }

      if (count === null) {
        // One-time move of a session saved by an older build.
        const old = legacy ? await legacy.getItem(key).catch(() => null) : null;
        if (old === null) return null;
        try {
          await write(key, old);
          await dropLegacy(key);
        } catch {
          // Keep the old copy until a later write succeeds, so the user stays signed in.
        }
        return old;
      }

      try {
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const part = await secure.getItemAsync(chunkKey(key, i));
          if (part === null) return null;
          parts.push(part);
        }
        return parts.join('');
      } catch {
        return null;
      }
    },

    async setItem(key, value) {
      await write(key, value);
      await dropLegacy(key);
    },

    async removeItem(key) {
      const count = (await readCount(key).catch(() => null)) ?? 0;
      await secure.deleteItemAsync(countKey(key));
      await deleteChunks(key, 0, count);
      await dropLegacy(key);
    },
  };
}
