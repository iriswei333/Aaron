import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Layout } from '@/constants/theme';

// Web .playdate-update-banner: the host changed something since you joined.
export function UpdateBanner({ summary, when, onDismiss }: { summary: string; when: string; onDismiss: () => void }) {
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={styles.copy}>
        <Text style={styles.title}>Playdate update</Text>
        <Text style={styles.text}>{summary}</Text>
        {when ? <Text style={styles.when}>{when}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Acknowledge playdate update" onPress={onDismiss} hitSlop={8} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: Colors.updateBorder, backgroundColor: Colors.updateBg, borderRadius: 13, paddingVertical: 12, paddingLeft: 16, paddingRight: 6 },
  copy: { flex: 1, gap: 3 },
  title: { color: Colors.updateTitle, fontSize: 14, fontWeight: '800' },
  text: { color: Colors.updateInk, fontSize: 14, lineHeight: 20 },
  when: { color: Colors.updateInk, fontSize: 12 },
  close: { width: Layout.minTouch, height: Layout.minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { backgroundColor: 'rgba(198, 137, 56, 0.15)' },
  closeText: { fontSize: 24, color: Colors.updateTitle },
});
