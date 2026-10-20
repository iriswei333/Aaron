import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useChat } from '@/lib/chat';

// Bottom tabs for the signed-in app.
// Native bottom tabs (UITabBar on iOS, Material bottom navigation on Android),
// matching the web app's four sections.
export default function TabsLayout() {
  // Unread family-chat messages show as a badge on the Family tab.
  const { unreadTotal } = useChat();
  return (
    <NativeTabs
      backgroundColor={Colors.surface}
      indicatorColor={Colors.brandSoft}
      tintColor={Colors.brandStrong}
      labelStyle={{ selected: { color: Colors.brandStrong } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="wb_sunny" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="studio">
        <NativeTabs.Trigger.Label>Play Studio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'paintpalette', selected: 'paintpalette.fill' }} md="palette" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="family">
        <NativeTabs.Trigger.Label>Family</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="groups" />
        <NativeTabs.Trigger.Badge hidden={unreadTotal === 0}>{unreadTotal > 99 ? '99+' : String(unreadTotal)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
