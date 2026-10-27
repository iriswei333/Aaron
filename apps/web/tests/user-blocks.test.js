import { describe, expect, it } from 'vitest';
import { blockSupabaseUser, createSupabaseChatMessage, listSupabaseBlocks, unblockSupabaseUser } from '../lib/backend.js';

function fakeSupabase({ rpc = {}, upsertError = null, deleteError = null } = {}) {
  const calls = [];
  const query = {
    upsert: async (row, options) => { calls.push(['upsert', row, options]); return { error: upsertError }; },
    delete: () => {
      const chain = { filters: [], eq(column, value) { chain.filters.push([column, value]); return chain.filters.length === 2 ? Promise.resolve({ error: deleteError }).then((result) => { calls.push(['delete', chain.filters]); return result; }) : chain; } };
      return chain;
    },
  };
  return {
    calls,
    from: (table) => { calls.push(['from', table]); return query; },
    rpc: async (name, args) => { calls.push(['rpc', name, args]); return rpc[name] || { data: null, error: null }; },
  };
}

const me = { id: 'me' };

describe('user blocks', () => {
  it('blocks idempotently with an upsert that ignores duplicates', async () => {
    const supabase = fakeSupabase();
    expect(await blockSupabaseUser(supabase, me, { userId: 'priya' })).toEqual({ userId: 'priya', blocked: true });
    expect(supabase.calls).toContainEqual(['upsert', { blocker_id: 'me', blocked_id: 'priya' }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }]);
  });

  it('refuses self-blocks and missing families', async () => {
    await expect(blockSupabaseUser(fakeSupabase(), me, { userId: 'me' })).rejects.toMatchObject({ status: 400 });
    await expect(blockSupabaseUser(fakeSupabase(), me, {})).rejects.toMatchObject({ status: 400 });
    await expect(blockSupabaseUser(fakeSupabase({ upsertError: { code: '23503', message: 'fk' } }), me, { userId: 'gone' })).rejects.toMatchObject({ status: 404 });
  });

  it('unblocks only the signed-in family’s row', async () => {
    const supabase = fakeSupabase();
    expect(await unblockSupabaseUser(supabase, me, { userId: 'priya' })).toEqual({ userId: 'priya', blocked: false });
    expect(supabase.calls).toContainEqual(['delete', [['blocker_id', 'me'], ['blocked_id', 'priya']]]);
  });

  it('lists blocked families with names', async () => {
    const supabase = fakeSupabase({ rpc: { list_my_blocks: { data: [{ blocked_id: 'priya', display_name: 'Priya', created_at: 't' }], error: null } } });
    expect(await listSupabaseBlocks(supabase)).toEqual([{ userId: 'priya', displayName: 'Priya', createdAt: 't' }]);
  });

  it('refuses to send into a blocked direct chat with a 403', async () => {
    const supabase = fakeSupabase({ rpc: { is_direct_chat_blocked: { data: true, error: null } } });
    await expect(createSupabaseChatMessage(supabase, me, { threadId: 't1', text: 'hi' })).rejects.toMatchObject({ status: 403, message: 'You can’t message this family.' });
  });
});
