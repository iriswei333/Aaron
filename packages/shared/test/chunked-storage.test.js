import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChunkedStorage, safeStorageKey, splitIntoChunks } from '../src/chunked-storage.js';

function memoryStore() {
  const map = new Map();
  return {
    map,
    get: async (key) => (map.has(key) ? map.get(key) : null),
    set: async (key, value) => { map.set(key, value); },
    remove: async (key) => { map.delete(key); },
  };
}

test('round-trips a large Supabase-sized session', async () => {
  const store = memoryStore();
  const storage = createChunkedStorage(store);
  const session = JSON.stringify({ access_token: 'a'.repeat(1500), refresh_token: 'r'.repeat(40), user: { email: 'p@example.com', meta: 'm'.repeat(3000) } });
  await storage.setItem('sb-abc-auth-token', session);
  assert.equal(await storage.getItem('sb-abc-auth-token'), session);
  assert.ok(Number(store.map.get('sb-abc-auth-token.n')) >= 3);
  for (const [, value] of store.map) assert.ok(value.length <= 1800);
});

test('overwriting with a shorter value removes stale chunks', async () => {
  const store = memoryStore();
  const storage = createChunkedStorage(store);
  await storage.setItem('k', 'x'.repeat(5000));
  await storage.setItem('k', 'short');
  assert.equal(await storage.getItem('k'), 'short');
  assert.deepEqual([...store.map.keys()].sort(), ['k.0', 'k.n']);
});

test('missing values, removal and half-written data', async () => {
  const store = memoryStore();
  const storage = createChunkedStorage(store);
  assert.equal(await storage.getItem('nothing'), null);
  await storage.setItem('k', 'y'.repeat(4000));
  store.map.delete('k.1');
  assert.equal(await storage.getItem('k'), null);
  await storage.removeItem('k');
  assert.equal(store.map.size, 0);
});

test('keys are sanitized and empty values survive', async () => {
  assert.equal(safeStorageKey('sb:project/auth token'), 'sb_project_auth_token');
  assert.deepEqual(splitIntoChunks(''), ['']);
  const storage = createChunkedStorage(memoryStore());
  await storage.setItem('empty', '');
  assert.equal(await storage.getItem('empty'), '');
});
