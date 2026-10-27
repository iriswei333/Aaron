import { describe, expect, it } from 'vitest';
import { createSupabaseChatReport } from '../lib/backend.js';

function fakeSupabase(result) {
  const calls = [];
  return { calls, rpc: async (name, args) => { calls.push([name, args]); return result; } };
}

describe('chat reports', () => {
  it('files a report through report_chat_message()', async () => {
    const supabase = fakeSupabase({ data: [{ report_id: 'r1', reported_at: '2026-10-25T00:00:00Z', already_reported: false }], error: null });
    const report = await createSupabaseChatReport(supabase, { messageId: 'm1', reason: 'harassment', details: '  mean  ' });
    expect(supabase.calls).toEqual([['report_chat_message', { target_message_id: 'm1', report_reason: 'harassment', report_details: 'mean' }]]);
    expect(report).toEqual({ id: 'r1', createdAt: '2026-10-25T00:00:00Z', alreadyReported: false });
  });

  it('passes through a repeat report', async () => {
    const supabase = fakeSupabase({ data: [{ report_id: 'r1', reported_at: 'x', already_reported: true }], error: null });
    expect((await createSupabaseChatReport(supabase, { messageId: 'm1', reason: 'spam' })).alreadyReported).toBe(true);
  });

  it('rejects bad input with a 400 before calling the database', async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    await expect(createSupabaseChatReport(supabase, { messageId: 'm1', reason: 'bogus' })).rejects.toMatchObject({ status: 400 });
    expect(supabase.calls).toHaveLength(0);
  });

  it('turns RPC validation errors into 400s and other errors into 500s', async () => {
    await expect(createSupabaseChatReport(fakeSupabase({ data: null, error: { code: 'P0001', message: 'You can\'t report your own message.' } }), { messageId: 'm1', reason: 'spam' }))
      .rejects.toMatchObject({ status: 400, message: 'You can\'t report your own message.' });
    const failure = await createSupabaseChatReport(fakeSupabase({ data: null, error: { code: '08006', message: 'connection lost' } }), { messageId: 'm1', reason: 'spam' }).catch((error) => error);
    expect(failure.status).toBeUndefined();
  });
});
