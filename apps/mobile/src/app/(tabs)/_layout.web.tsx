import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

// Web preview of the app (expo start --web): a simple bottom tab bar.
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View style={styles.bar}>
          <TabTrigger name="index" href="/" asChild><TabButton>Today</TabButton></TabTrigger>
          <TabTrigger name="discover" href="/discover" asChild><TabButton>Discover</TabButton></TabTrigger>
          <TabTrigger name="studio" href="/studio" asChild><TabButton>Play Studio</TabButton></TabTrigger>
          <TabTrigger name="family" href="/family" asChild><TabButton>Family</TabButton></TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={[styles.button, isFocused && styles.buttonActive]}>
      <Text style={[styles.label, isFocused && styles.labelActive]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.two,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control },
  buttonActive: { backgroundColor: Colors.brandSoft },
  label: { color: '#5c6b60', fontSize: 13, fontWeight: '800' },
  labelActive: { color: Colors.brandStrong },
});
