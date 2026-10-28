// Sends push notifications to the native app through Expo's push service,
// which delivers to Apple (APNs) and Google (FCM) for us.
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Must match the Android channel the app creates (apps/mobile/src/lib/push-notifications.ts).
export const AI_CREATIONS_CHANNEL_ID = 'ai-creations';
const MAX_MESSAGES_PER_REQUEST = 100;

export function isExpoPushToken(value) {
  return typeof value === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(value);
}

/**
 * Push messages for one in-app notification (an AI creation finished or failed).
 * `data` is what the app reads when the family taps the notification.
 * @param {string[]} tokens
 * @param {{ id?: string|null, notificationType: string, title: string, message: string, href?: string, assetId?: string|null, jobId?: string|null, assetType?: string|null, pageKey?: string|null }} notification
 */
export function buildAiAssetPushMessages(tokens, notification) {
  const data = {
    type: notification.notificationType,
    notificationId: notification.id || null,
    jobId: notification.jobId || null,
    assetId: notification.assetId || null,
    assetType: notification.assetType || null,
    pageKey: notification.pageKey || null,
    href: notification.href || null,
  };
  return [...new Set(tokens)].filter(isExpoPushToken).map((to) => ({
    to,
    title: notification.title,
    body: notification.message,
    data,
    sound: 'default',
    priority: 'high',
    channelId: AI_CREATIONS_CHANNEL_ID,
  }));
}

/**
 * POSTs messages to Expo in chunks of 100. Returns the tokens Expo says are no
 * longer registered (app uninstalled, notifications revoked), so the caller can delete them.
 * @param {Array<Record<string, any>>} messages
 * @param {{ fetchImpl?: typeof fetch, accessToken?: string, timeoutMs?: number }} [options]
 */
export async function sendExpoPushMessages(messages, { fetchImpl = globalThis.fetch, accessToken = process.env.EXPO_ACCESS_TOKEN || '', timeoutMs = 10000 } = {}) {
  const invalidTokens = [];
  const errors = [];
  for (let start = 0; start < messages.length; start += MAX_MESSAGES_PER_REQUEST) {
    const chunk = messages.slice(start, start + MAX_MESSAGES_PER_REQUEST);
    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        // Only needed if "Enhanced push security" is turned on for the Expo project.
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      errors.push(body?.errors?.[0]?.message || `Expo push request failed (${response.status}).`);
      continue;
    }
    const tickets = Array.isArray(body?.data) ? body.data : [];
    tickets.forEach((ticket, index) => {
      if (ticket?.status !== 'error') return;
      if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(chunk[index].to);
      else errors.push(ticket.message || ticket.details?.error || 'Expo push ticket error.');
    });
  }
  return { sent: messages.length, invalidTokens, errors };
}

// ── Family chat ─────────────────────────────────────────────────────────────

// Must match the Android channel the app creates (apps/mobile/src/lib/push-notifications.ts).
export const CHAT_CHANNEL_ID = 'chat';
const CHAT_PREVIEW_MAX = 140;

/** One-line lock-screen preview of a chat message. */
export function chatPushPreview(message) {
  const text = String(message?.text || '').replace(/\s+/g, ' ').trim();
  if (text) return text.length > CHAT_PREVIEW_MAX ? `${text.slice(0, CHAT_PREVIEW_MAX - 1)}…` : text;
  if (message?.mediaType === 'video') return 'Sent a video';
  if (message?.mediaType === 'photo') return 'Sent a photo';
  return 'New message';
}

/**
 * Push messages for a new chat message. A direct chat is titled with the sender;
 * a playdate group chat with the playground (like the chat list), sender before the preview.
 * `data.threadId` is what the app opens when the family taps the notification.
 * @param {string[]} tokens
 * @param {{ threadId: string, messageId?: string|null, threadType: string, senderName: string, threadTitle?: string, message: { text?: string, mediaType?: string } }} chat
 */
export function buildChatPushMessages(tokens, chat) {
  const preview = chatPushPreview(chat.message);
  const group = chat.threadType === 'playdate';
  const title = group ? chat.threadTitle || 'Playdate chat' : chat.senderName;
  const body = group ? `${chat.senderName}: ${preview}` : preview;
  const data = { type: 'chat_message', threadId: chat.threadId, messageId: chat.messageId || null };
  return [...new Set(tokens)].filter(isExpoPushToken).map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
    channelId: CHAT_CHANNEL_ID,
  }));
}
