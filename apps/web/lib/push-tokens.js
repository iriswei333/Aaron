import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAiAssetPushMessages, isExpoPushToken, sendExpoPushMessages } from './expo-push.js';

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
