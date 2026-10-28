import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAiAssetPushMessages, buildChatPushMessages, isExpoPushToken, sendExpoPushMessages } from './expo-push.js';

// Expo push tokens registered by the native app. Supabase table `push_tokens`
// in production; a JSON file for local (no-Supabase) development, like ai-jobs.js.

const LOCAL_STATE = resolve('data/push-tokens.json');
const PLATFORMS = new Set(['ios', 'android']);

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
async function readLocalTokens() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { tokens: [] }; throw error; }
}
async function writeLocalTokens(state) { await mkdir(resolve('data'), { recursive: true }); await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`); }

function invalid(message) { const error = new Error(message); error.code = 'INVALID'; return error; }

export async function registerPushToken(current, { token, platform, deviceName = '' } = {}) {
  if (!isExpoPushToken(token)) throw invalid('A valid Expo push token is required.');
  if (!PLATFORMS.has(platform)) throw invalid('platform must be "ios" or "android".');
  const name = String(deviceName || '').slice(0, 120) || null;
  if (current.mode === 'supabase') {
    const { error } = await current.supabase.rpc('register_push_token', { requested_token: token, requested_platform: platform, requested_device_name: name });
    if (error) throw new Error(error.message);
    return;
  }
  const state = await readLocalTokens();
  state.tokens = state.tokens.filter((item) => item.token !== token);
  state.tokens.push({ ownerId: ownerId(current), token, platform, deviceName: name, updatedAt: new Date().toISOString() });
  await writeLocalTokens(state);
}

export async function unregisterPushToken(current, token) {
  if (!token) throw invalid('token is required.');
  if (current.mode === 'supabase') {
    const { error } = await current.supabase.from('push_tokens').delete().eq('token', token).eq('profile_id', current.authUser.id);
    if (error) throw new Error(error.message);
    return;
  }
  const state = await readLocalTokens();
  state.tokens = state.tokens.filter((item) => !(item.token === token && item.ownerId === ownerId(current)));
  await writeLocalTokens(state);
}

async function listPushTokens(current) {
  if (current.mode === 'supabase') {
    const { data, error } = await current.supabase.from('push_tokens').select('token').eq('profile_id', current.authUser.id);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => row.token);
  }
  const state = await readLocalTokens();
  return state.tokens.filter((item) => item.ownerId === ownerId(current)).map((item) => item.token);
}

async function removeTokens(current, tokens) {
  if (!tokens.length) return;
  if (current.mode === 'supabase') {
    await current.supabase.from('push_tokens').delete().in('token', tokens).eq('profile_id', current.authUser.id);
    return;
  }
  const state = await readLocalTokens();
  state.tokens = state.tokens.filter((item) => !tokens.includes(item.token));
  await writeLocalTokens(state);
}

/**
 * Pushes an in-app notification to every device the family registered.
 * Never throws: a push problem must not fail the AI job that produced the notification.
 * @param {any} current profile session (user-scoped or worker/admin)
 * @param {Parameters<typeof buildAiAssetPushMessages>[1]} notification
 * @param {{ send?: typeof sendExpoPushMessages }} [options]
 */
export async function pushNotificationToDevices(current, notification, { send = sendExpoPushMessages } = {}) {
  try {
    const tokens = await listPushTokens(current);
    const messages = buildAiAssetPushMessages(tokens, notification);
    if (!messages.length) return { sent: 0, invalidTokens: [], errors: [] };
    const result = await send(messages);
    await removeTokens(current, result.invalidTokens).catch(() => {});
    if (result.errors.length) console.warn('[push] Expo push errors:', result.errors.slice(0, 3).join(' | '));
    return result;
  } catch (error) {
    console.warn('[push] Could not send push notification:', error?.message || error);
    return { sent: 0, invalidTokens: [], errors: [String(error?.message || error)] };
  }
}

/**
 * Pushes a new chat message to every device of the thread's other members.
 * Needs the service-role client (createSupabaseAdminClient): row-level security
 * rightly stops the sender from reading other families' push tokens.
 * Members who blocked the sender get no push (they don't see the message either).
 * Never throws: the message is already saved.
 * @param {import('@supabase/supabase-js').SupabaseClient|null} admin
 * @param {{ senderId: string, message: { id?: string, threadId?: string, text?: string, mediaType?: string } }} chat
 * @param {{ send?: typeof sendExpoPushMessages }} [options]
 */
export async function pushChatMessageToMembers(admin, { senderId, message }, { send = sendExpoPushMessages } = {}) {
  const none = { sent: 0, invalidTokens: [], errors: [] };
  try {
    const threadId = message?.threadId;
    if (!threadId || !senderId) return none;
    if (!admin) {
      console.warn('[push] Chat push skipped: SUPABASE_SERVICE_ROLE_KEY is not set.');
      return none;
    }
    const [members, thread, sender] = await Promise.all([
      admin.from('chat_thread_members').select('user_id').eq('thread_id', threadId).neq('user_id', senderId),
      admin.from('chat_threads').select('thread_type, play_date_id').eq('id', threadId).maybeSingle(),
      admin.from('profiles').select('display_name').eq('id', senderId).maybeSingle(),
    ]);
    if (members.error) throw members.error;
    if (thread.error) throw thread.error;
    let recipients = (members.data || []).map((row) => row.user_id);
    if (!recipients.length) return none;

    const blocks = await admin.from('user_blocks').select('blocker_id').eq('blocked_id', senderId).in('blocker_id', recipients);
    if (blocks.error) throw blocks.error;
    const blockers = new Set((blocks.data || []).map((row) => row.blocker_id));
    recipients = recipients.filter((id) => !blockers.has(id));
    if (!recipients.length) return none;

    const tokenRows = await admin.from('push_tokens').select('token').in('profile_id', recipients);
    if (tokenRows.error) throw tokenRows.error;
    const tokens = (tokenRows.data || []).map((row) => row.token);
    if (!tokens.length) return none;

    const threadType = thread.data?.thread_type || 'direct';
    let threadTitle = '';
    if (threadType === 'playdate' && thread.data?.play_date_id) {
      const playDate = await admin.from('play_dates').select('playground_name').eq('id', thread.data.play_date_id).maybeSingle();
      threadTitle = playDate.data?.playground_name || '';
    }
    const senderName = String(sender.data?.display_name || '').trim() || 'A family';
    const messages = buildChatPushMessages(tokens, { threadId, messageId: message.id, threadType, threadTitle, senderName, message });
    if (!messages.length) return none;
    const result = await send(messages);
    if (result.invalidTokens.length) await admin.from('push_tokens').delete().in('token', result.invalidTokens).then(() => {}, () => {});
    if (result.errors.length) console.warn('[push] Expo chat push errors:', result.errors.slice(0, 3).join(' | '));
    return result;
  } catch (error) {
    console.warn('[push] Could not send chat push:', error?.message || error);
    return { ...none, errors: [String(error?.message || error)] };
  }
}
