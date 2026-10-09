import { describe, expect, it, vi } from 'vitest';
import { AI_CREATIONS_CHANNEL_ID, EXPO_PUSH_URL, buildAiAssetPushMessages, isExpoPushToken, sendExpoPushMessages } from '../lib/expo-push.js';
import { pushNotificationToDevices } from '../lib/push-tokens.js';

const ready = {
  id: 'n1', notificationType: 'ai_asset_ready', title: 'Bunny Story is ready', message: 'Tap to open your new family asset.',
  href: '/family?practiceStory=a1', assetId: 'a1', jobId: 'j1', assetType: 'practice_story',
};

describe('Expo push messages', () => {
  it('recognizes Expo push tokens only', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('abc123')).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
  });

  it('builds one message per unique valid token with the data the app opens', () => {
    const messages = buildAiAssetPushMessages(['ExponentPushToken[a]', 'ExponentPushToken[a]', 'bogus', 'ExponentPushToken[b]'], ready);
    expect(messages.map((m) => m.to)).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    expect(messages[0]).toMatchObject({
      title: 'Bunny Story is ready', body: 'Tap to open your new family asset.', sound: 'default', channelId: AI_CREATIONS_CHANNEL_ID,
      data: { type: 'ai_asset_ready', notificationId: 'n1', jobId: 'j1', assetId: 'a1', assetType: 'practice_story', href: '/family?practiceStory=a1' },
    });
  });
});

describe('sendExpoPushMessages', () => {
  it('posts to Expo and reports tokens that are no longer registered', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [
      { status: 'ok', id: 't1' },
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
    ] }), { status: 200 }));
    const messages = buildAiAssetPushMessages(['ExponentPushToken[a]', 'ExponentPushToken[b]'], ready);
    const result = await sendExpoPushMessages(messages, { fetchImpl, accessToken: '' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(EXPO_PUSH_URL);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toHaveLength(2);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[b]']);
    expect(result.errors).toEqual([]);
  });

  it('chunks requests at 100 messages and sends the access token when configured', async () => {
    const fetchImpl = vi.fn(async (_url, init) => new Response(JSON.stringify({ data: JSON.parse(init.body).map(() => ({ status: 'ok' })) })));
    const tokens = Array.from({ length: 150 }, (_, index) => `ExponentPushToken[${index}]`);
    await sendExpoPushMessages(buildAiAssetPushMessages(tokens, ready), { fetchImpl, accessToken: 'secret' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer secret');
  });
});

describe('pushNotificationToDevices', () => {
  function fakeSupabase(tokens) {
    const deleted = [];
    const supabase = {
      deleted,
      from: () => ({
        select: () => ({ eq: async () => ({ data: tokens.map((token) => ({ token })), error: null }) }),
        delete: () => ({ in: (_column, values) => ({ eq: async () => { deleted.push(...values); return { error: null }; } }) }),
      }),
    };
    return supabase;
  }

  it('sends to the family devices and removes unregistered tokens', async () => {
    const supabase = fakeSupabase(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    const send = vi.fn(async (messages) => ({ sent: messages.length, invalidTokens: ['ExponentPushToken[b]'], errors: [] }));
    const result = await pushNotificationToDevices({ mode: 'supabase', supabase, authUser: { id: 'p1' } }, ready, { send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(2);
    expect(supabase.deleted).toEqual(['ExponentPushToken[b]']);
  });

  it('does nothing without tokens and never throws', async () => {
    const send = vi.fn();
    await expect(pushNotificationToDevices({ mode: 'supabase', supabase: fakeSupabase([]), authUser: { id: 'p1' } }, ready, { send })).resolves.toMatchObject({ sent: 0 });
    expect(send).not.toHaveBeenCalled();
    const broken = { mode: 'supabase', authUser: { id: 'p1' }, supabase: { from: () => { throw new Error('db down'); } } };
    await expect(pushNotificationToDevices(broken, ready, { send })).resolves.toMatchObject({ sent: 0 });
  });
});
