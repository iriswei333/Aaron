import { describe, expect, it } from 'vitest';
import { listSupabaseChatThreads } from '../lib/backend.js';

// Other families' profile rows aren't readable (202610290001_profile_privacy.sql): the chat
// thread list gets names only from chat_member_names(), never from the profiles table.

function fakeSupabase(tables, rpcs) {
  const calls = [];
  const from = (table) => {
    calls.push(['from', table]);
    if (table === 'profiles') throw new Error('chat must not read the profiles table');
    const chain = { select: () => chain, eq: () => chain, in: () => chain, then: (resolve) => resolve({ data: tables[table] || [], error: null }) };
    return chain;
  };
  const rpc = async (name, args) => { calls.push(['rpc', name, args]); return rpcs[name] ? rpcs[name](args) : { data: null, error: null }; };
  return { calls, from, rpc };
}

describe('chat thread list', () => {
  it('shows participants by display name only, from chat_member_names()', async () => {
    const supabase = fakeSupabase({
      chat_thread_members: [{ thread_id: 't1', user_id: 'me', last_read_at: null }, { thread_id: 't1', user_id: 'priya', last_read_at: null }],
      chat_threads: [{ id: 't1', thread_type: 'direct', play_date_id: null, created_at: '2026-10-01T00:00:00Z' }],
      chat_messages: [],
      play_date_participants: [],
      user_blocks: [],
    }, {
      chat_member_names: () => ({ data: [{ id: 'me', display_name: 'Me' }, { id: 'priya', display_name: 'Priya' }], error: null }),
    });

    const [thread] = await listSupabaseChatThreads(supabase, { id: 'me' });

    expect(supabase.calls).toContainEqual(['rpc', 'chat_member_names', { user_ids: ['me', 'priya'] }]);
    expect(thread.title).toBe('Priya');
    expect(thread.participants).toEqual([{ id: 'priya', displayName: 'Priya' }]);
  });

  it('surfaces an error when names cannot be loaded', async () => {
    const supabase = fakeSupabase({
      chat_thread_members: [{ thread_id: 't1', user_id: 'me', last_read_at: null }],
      chat_threads: [{ id: 't1', thread_type: 'direct', play_date_id: null, created_at: 't' }],
      chat_messages: [], play_date_participants: [], user_blocks: [],
    }, { chat_member_names: () => ({ data: null, error: { message: 'boom' } }) });
    await expect(listSupabaseChatThreads(supabase, { id: 'me' })).rejects.toThrow('boom');
  });
});
