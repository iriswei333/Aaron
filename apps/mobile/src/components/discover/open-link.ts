import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/** Event websites open in an in-app browser sheet. */
export function openWebsite(url: string) {
  if (!url) return;
  if (Platform.OS === 'web') globalThis.open?.(url, '_blank', 'noopener');
  else WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}

/** Map links hand off to Google Maps / Apple Maps (or the browser). */
export function openMap(url: string) {
  if (!url) return;
  if (Platform.OS === 'web') globalThis.open?.(url, '_blank', 'noopener');
  else Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url));
}
