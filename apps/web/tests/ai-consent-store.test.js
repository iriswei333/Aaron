import { describe, expect, it } from 'vitest';
import { AI_CONSENT_REQUIRED, AI_CONSENT_VERSION } from '@sproutcue/shared/ai-consent';
import { setAiConsent } from '../lib/ai-consent.js';
import { enqueueAiJob } from '../lib/ai-jobs.js';
import { createFamilyPhoto } from '../lib/family-photos.js';

// Library-level checks and the grant/withdraw flow, against a fake Supabase client.

function fakeSupabase({ rpcError = null } = {}) {
  const calls = [];
  const builder = (table) => {
    const call = { table, filters: [] };
    calls.push(call);
    const chain = {
      update(values) { call.update = values; return chain; },
      eq(column, value) { call.filters.push([column, value]); return chain; },
      select() { return chain; },
      single: async () => ({ data: { id: 'family-1', email: 'p@example.com', display_name: 'Parent', ai_consent_at: call.update?.ai_consent_at ?? null, ai_consent_version: call.update?.ai_consent_version ?? null }, error: null }),
      then(resolve) { resolve({ data: [{ id: 'job-1' }], error: null }); },
    };
    return chain;
  };
  return { calls, from: builder, rpc: async () => ({ data: null, error: rpcError }) };
}

const family = (supabase, aiConsent = null) => ({ mode: 'supabase', authUser: { id: 'family-1' }, user: { id: 'family-1', aiConsent }, supabase });

describe('setAiConsent', () => {
  it('records the current version when granted', async () => {
    const supabase = fakeSupabase();
    const user = await setAiConsent(family(supabase), true);
    expect(user.aiConsent).toMatchObject({ version: AI_CONSENT_VERSION });
    expect(supabase.calls[0]).toMatchObject({ table: 'profiles', update: { ai_consent_version: AI_CONSENT_VERSION } });
  });

  it('clears consent and cancels queued jobs when withdrawn', async () => {
    const supabase = fakeSupabase();
    const user = await setAiConsent(family(supabase, { grantedAt: 'x', version: AI_CONSENT_VERSION }), false);
    expect(user.aiConsent).toBeNull();
    const jobs = supabase.calls.find((call) => call.table === 'ai_generation_jobs');
    expect(jobs.update).toMatchObject({ status: 'failed', error_code: AI_CONSENT_REQUIRED });
    expect(jobs.filters).toEqual([['profile_id', 'family-1'], ['status', 'queued']]);
  });
});

describe('library checks', () => {
  it('enqueueAiJob refuses without consent and never calls the database', async () => {
    const supabase = fakeSupabase();
    supabase.rpc = async () => { throw new Error('should not be called'); };
    await expect(enqueueAiJob(family(supabase), { jobType: 'toy_play' })).rejects.toMatchObject({ code: AI_CONSENT_REQUIRED });
  });

  it('enqueueAiJob maps the database consent check to a consent error', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'AI_CONSENT_REQUIRED' } });
    await expect(enqueueAiJob(family(supabase, { grantedAt: 'x', version: AI_CONSENT_VERSION }), { jobType: 'toy_play' })).rejects.toMatchObject({ code: AI_CONSENT_REQUIRED });
  });

  it('createFamilyPhoto refuses AI photo kinds without consent, before any check runs', async () => {
    let checked = false;
    const checkPhoto = async () => { checked = true; return { status: 'passed' }; };
    for (const sourceKind of ['picture_book', 'practice_story', 'toy_play']) {
      await expect(createFamilyPhoto(family({}), { buffer: Buffer.from('x'), mimeType: 'image/png' }, { sourceKind, checkPhoto })).rejects.toMatchObject({ code: AI_CONSENT_REQUIRED });
    }
    expect(checked).toBe(false);
  });
});
