import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiRequest } from './api';

// Push notifications through Expo's push service (it forwards to APNs and FCM).
// The app registers this device's Expo push token with POST /api/notifications/push-tokens;
// the server pushes when an AI creation is ready (apps/web/lib/push-tokens.js).
//
// Remote push needs a development or store build: Expo Go on Android can't receive it,
// and getExpoPushTokenAsync needs the EAS projectId in app.json (`npx eas-cli@latest init`).

/** Must match AI_CREATIONS_CHANNEL_ID in apps/web/lib/expo-push.js. */
export const AI_CREATIONS_CHANNEL_ID = 'ai-creations';

/** What the server puts in `data` (buildAiAssetPushMessages). */
export type AiPushData = {
  type?: string;
  notificationId?: string | null;
  jobId?: string | null;
  assetId?: string | null;
  assetType?: string | null;
  pageKey?: string | null;
  href?: string | null;
};

// The job whose progress sheet / toast is on screen right now. Its push is
// redundant while the app is open, so we skip the banner for it.
let visibleJobId = '';
export function setVisibleAiJobId(jobId: string) {
  visibleJobId = jobId;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = (notification.request.content.data || {}) as AiPushData;
      const show = !(data.jobId && data.jobId === visibleJobId);
      return { shouldShowBanner: show, shouldShowList: true, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
}

export function pushDataFrom(notification: Notifications.Notification): AiPushData {
  return (notification.request.content.data || {}) as AiPushData;
}

function easProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

// Token last registered, and for which family: a different parent signing in on the
// same phone must register again so the server moves the token to their profile.
let registeredToken = '';
let registeredFor = '';

/**
 * Gets this device's Expo push token and registers it with the server.
 * `prompt: false` only registers when the family already allowed notifications;
 * `prompt: true` asks first (we ask when they start an AI creation, so the request makes sense).
 * Returns the token, or null when push isn't available or allowed.
 */
export async function registerForPushNotifications({ prompt, userId }: { prompt: boolean; userId: string }): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null; // simulators/emulators have no push token

  // Android 13+ shows the permission prompt only once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(AI_CREATIONS_CHANNEL_ID, {
      name: 'AI creations',
      description: 'When your picture books, practice stories and toy play ideas are ready',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    if (!prompt || !canAskAgain) return null;
    ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
  }

  const projectId = easProjectId();
  if (!projectId) {
    console.warn('[push] No EAS projectId in app.json (extra.eas.projectId). Run `npx eas-cli@latest init` in apps/mobile.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token !== registeredToken || userId !== registeredFor) {
      await apiRequest('/notifications/push-tokens', {
        method: 'POST',
        body: { token, platform: Platform.OS, deviceName: Device.deviceName || Device.modelName || '' },
      });
      registeredToken = token;
      registeredFor = userId;
    }
    return token;
  } catch (error) {
    // Offline, or the server is unreachable: we try again next launch / next creation.
    console.warn('[push] Could not register for push notifications:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Stop pushes to this device for the signed-in family. Call before signing out (it needs the session). */
export async function unregisterPushNotifications(): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = '';
  registeredFor = '';
  try {
    await apiRequest('/notifications/push-tokens', { method: 'DELETE', body: { token }, timeoutMs: 5000 });
  } catch {
    // Best effort: the server also drops tokens Expo reports as unregistered.
  }
}
