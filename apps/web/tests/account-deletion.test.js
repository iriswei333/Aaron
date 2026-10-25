import { describe, expect, it } from 'vitest';
import { deleteSupabaseAccount } from '../lib/account-deletion.js';

function fakeAdmin(files, { deleteUserError = null } = {}) {
  const objects = new Set(files);
  const calls = [];
  const storage = {
    from: (bucket) => ({
      list: async (folder, { limit, offset }) => {
        const children = new Map();
        for (const path of objects) {
          if (!path.startsWith(`${folder}/`)) continue;
          const [name, ...rest] = path.slice(folder.length + 1).split('/');
          children.set(name, rest.length ? null : `id-${name}`);
        }
        const data = [...children].map(([name, id]) => ({ name, id })).slice(offset, offset + limit);
        return { data, error: null };
      },
      remove: async (paths) => { calls.push(['remove', bucket, paths]); paths.forEach((path) => objects.delete(path)); return { error: null }; },
    }),
  };
  const auth = { admin: { deleteUser: async (id) => { calls.push(['deleteUser', id]); return { error: deleteUserError }; } } };
  return { admin: { storage, auth }, objects, calls };
}

describe('account deletion', () => {
  it('removes every file under the user prefix, then deletes the auth user', async () => {
    const { admin, objects, calls } = fakeAdmin([
      'u1/photos/a.jpg',
      'u1/picture-books/b1/pages/p1.png',
      'u1/incoming/x.png',
      'u2/photos/keep.jpg',
    ]);
    const result = await deleteSupabaseAccount({ id: 'u1' }, { admin });
    expect(result.removedFiles).toBe(3);
    expect([...objects]).toEqual(['u2/photos/keep.jpg']);
    expect(calls.at(-1)).toEqual(['deleteUser', 'u1']);
  });

  it('keeps the account when file removal fails so the user can retry', async () => {
    const { admin, calls } = fakeAdmin(['u1/photos/a.jpg']);
    admin.storage.from = () => ({ list: async () => ({ data: null, error: { message: 'boom' } }) });
    await expect(deleteSupabaseAccount({ id: 'u1' }, { admin })).rejects.toThrow('boom');
    expect(calls.find(([name]) => name === 'deleteUser')).toBeUndefined();
  });

  it('reports a 503 when the service role key is missing', async () => {
    await expect(deleteSupabaseAccount({ id: 'u1' }, { admin: null })).rejects.toMatchObject({ status: 503 });
  });

  it('surfaces auth deletion errors', async () => {
    const { admin } = fakeAdmin([], { deleteUserError: { status: 500, message: 'db error' } });
    await expect(deleteSupabaseAccount({ id: 'u1' }, { admin })).rejects.toThrow('db error');
  });
});
