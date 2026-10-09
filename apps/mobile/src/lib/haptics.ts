import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// SproutCue's haptic vocabulary — calm and sparse, never on scroll or every tap.
//   select()  choosing between options: filter chips, Map/List, story goals, map pins, tabs-like toggles
//   tap()     main actions: primary buttons, Today shortcuts
//   pull()    pull-to-refresh starts
//   success() something finished well: AI creation ready, saved, joined, playdate created
//   error()   an action failed
// iOS respects the system "System Haptics" setting; Android uses the vibration motor sparingly.
// No-op on web.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
const run = (effect: () => Promise<void>) => {
  if (enabled) effect().catch(() => {});
};

export const haptics = {
  select: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  pull: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
