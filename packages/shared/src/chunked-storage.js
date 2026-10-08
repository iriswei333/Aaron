// Splits large values across several keys of a small key-value store.
// Used by apps/mobile to keep Supabase sessions in expo-secure-store, whose
// values should stay under ~2 KB (a session with user JSON can be larger).
//   <key>.n            → number of chunks
//   <key>.0, <key>.1 … → the pieces

export const DEFAULT_CHUNK_SIZE = 1800;

/** Secure-store keys may only contain letters, numbers, ".", "-" and "_". */
export function safeStorageKey(key) {
  return String(key).replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * @param {string} value
 * @param {number} [size]
 * @returns {string[]}
 */
export function splitIntoChunks(value, size = DEFAULT_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < value.length; index += size) chunks.push(value.slice(index, index + size));
  return chunks.length ? chunks : [''];
}

/**
 * @typedef {object} KeyValueStore
 * @property {(key: string) => Promise<string | null>} get
 * @property {(key: string, value: string) => Promise<void>} set
 * @property {(key: string) => Promise<void>} remove
 */

/**
 * Wraps a key-value store with the getItem/setItem/removeItem shape Supabase expects.
 * @param {KeyValueStore} store
 * @param {{ chunkSize?: number }} [options]
 * @returns {{ getItem: (key: string) => Promise<string | null>, setItem: (key: string, value: string) => Promise<void>, removeItem: (key: string) => Promise<void> }}
 */
export function createChunkedStorage(store, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  async function removeChunks(base) {
    const count = Number(await store.get(`${base}.n`)) || 0;
    await Promise.all(Array.from({ length: count }, (_, index) => store.remove(`${base}.${index}`)));
    await store.remove(`${base}.n`);
  }

  return {
    async getItem(key) {
      const base = safeStorageKey(key);
      const countText = await store.get(`${base}.n`);
      if (countText === null || countText === undefined) return null;
      const count = Number(countText);
      if (!Number.isInteger(count) || count < 1) return null;
      const parts = await Promise.all(Array.from({ length: count }, (_, index) => store.get(`${base}.${index}`)));
      // A missing piece means a half-written value: treat it as signed out rather than corrupt.
      if (parts.some((part) => part === null || part === undefined)) return null;
      return parts.join('');
    },
    async setItem(key, value) {
      const base = safeStorageKey(key);
      await removeChunks(base);
      const chunks = splitIntoChunks(String(value), chunkSize);
      await Promise.all(chunks.map((chunk, index) => store.set(`${base}.${index}`, chunk)));
      // Written last, so an interrupted write is never read as complete.
      await store.set(`${base}.n`, String(chunks.length));
    },
    async removeItem(key) {
      await removeChunks(safeStorageKey(key));
    },
  };
}
