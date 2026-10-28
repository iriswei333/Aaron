import { describe, expect, it, vi } from 'vitest';
import { AI_CREATIONS_CHANNEL_ID, CHAT_CHANNEL_ID, EXPO_PUSH_URL, buildAiAssetPushMessages, buildChatPushMessages, chatPushPreview, isExpoPushToken, sendExpoPushMessages } from '../lib/expo-push.js';
import { pushChatMessageToMembers, pushNotificationToDevices } from '../lib/push-tokens.js';

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

describe('chat push messages', () => {
  it('previews text, photos and videos in one line', () => {
    expect(chatPushPreview({ text: '  See you\n at 3?  ' })).toBe('See you at 3?');
    expect(chatPushPreview({ text: 'x'.repeat(300) })).toHaveLength(140);
    expect(chatPushPreview({ mediaType: 'photo' })).toBe('Sent a photo');
    expect(chatPushPreview({ mediaType: 'video' })).toBe('Sent a video');
  });

  it('titles a direct chat with the sender and a playdate chat with the playground', () => {
    const [direct] = buildChatPushMessages(['ExponentPushToken[a]'], { threadId: 't1', messageId: 'm1', threadType: 'direct', senderName: 'Maya', message: { text: 'Hi!' } });
    expect(direct).toMatchObject({ title: 'Maya', body: 'Hi!', channelId: CHAT_CHANNEL_ID, data: { type: 'chat_message', threadId: 't1', messageId: 'm1' } });
    const [group] = buildChatPushMessages(['ExponentPushToken[a]'], { threadId: 't2', threadType: 'playdate', threadTitle: 'Dolores Park', senderName: 'Maya', message: { mediaType: 'photo' } });
    expect(group).toMatchObject({ title: 'Dolores Park', body: 'Maya: Sent a photo' });
  });
});

describe('pushChatMessageToMembers', () => {
  // Minimal Supabase query builder over in-memory tables.
  function fakeAdmin(tables) {
    const deleted = [];
    const query = (table) => {
      let rows = [...(tables[table] || [])];
      let removing = false;
      const builder = {
        select: () => builder,
        delete: () => { removing = true; return builder; },
        eq: (column, value) => { rows = rows.filter((row) => row[column] === value); return builder; },
        neq: (column, value) => { rows = rows.filter((row) => row[column] !== value); return builder; },
        in: (column, values) => { rows = rows.filter((row) => values.includes(row[column])); return builder; },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve, reject) => {
          if (removing) deleted.push(...rows.map((row) => row.token));
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return builder;
    };
    return { deleted, from: query };
  }

  const tables = {
    chat_thread_members: [
      { thread_id: 't1', user_id: 'sender' }, { thread_id: 't1', user_id: 'friend' }, { thread_id: 't1', user_id: 'blocker' }, { thread_id: 'other', user_id: 'stranger' },
    ],
    chat_threads: [{ id: 't1', thread_type: 'playdate', play_date_id: 'pd1' }],
    play_dates: [{ id: 'pd1', playground_name: 'Dolores Park' }],
    profiles: [{ id: 'sender', display_name: 'Maya' }],
    user_blocks: [{ blocker_id: 'blocker', blocked_id: 'sender' }],
    push_tokens: [
      { profile_id: 'sender', token: 'ExponentPushToken[me]' }, { profile_id: 'friend', token: 'ExponentPushToken[f1]' }, { profile_id: 'friend', token: 'ExponentPushToken[f2]' },
      { profile_id: 'blocker', token: 'ExponentPushToken[b]' }, { profile_id: 'stranger', token: 'ExponentPushToken[s]' },
    ],
  };

  it("pushes to other members' devices, skipping the sender and families who blocked them", async () => {
    const admin = fakeAdmin(tables);
    const send = vi.fn(async (messages) => ({ sent: messages.length, invalidTokens: ['ExponentPushToken[f2]'], errors: [] }));
    await pushChatMessageToMembers(admin, { senderId: 'sender', message: { id: 'm1', threadId: 't1', text: 'On our way' } }, { send });
    const messages = send.mock.calls[0][0];
    expect(messages.map((m) => m.to)).toEqual(['ExponentPushToken[f1]', 'ExponentPushToken[f2]']);
    expect(messages[0]).toMatchObject({ title: 'Dolores Park', body: 'Maya: On our way', data: { type: 'chat_message', threadId: 't1', messageId: 'm1' } });
    expect(admin.deleted).toEqual(['ExponentPushToken[f2]']);
  });

  it('does nothing without the admin client and never throws', async () => {
    const send = vi.fn();
    await expect(pushChatMessageToMembers(null, { senderId: 'sender', message: { threadId: 't1' } }, { send })).resolves.toMatchObject({ sent: 0 });
    const broken = { from: () => { throw new Error('db down'); } };
    await expect(pushChatMessageToMembers(broken, { senderId: 'sender', message: { threadId: 't1' } }, { send })).resolves.toMatchObject({ sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
