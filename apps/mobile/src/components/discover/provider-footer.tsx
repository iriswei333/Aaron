import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Layout } from '@/constants/theme';

// Web .discover-provider-note: source status + "Refresh results".
export function ProviderFooter({ loading, status, onRefresh }: { loading: boolean; status: string; onRefresh: () => void }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, loading && styles.dotLoading]} />
      <Text style={styles.text}>{loading ? 'Checking playgrounds, events, and story times…' : status || 'Results from SproutCue and local providers.'}</Text>
      <Pressable accessibilityRole="button" onPress={onRefresh} disabled={loading} hitSlop={8} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Refresh results</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  dotLoading: { backgroundColor: Colors.sun },
  text: { flex: 1, color: Colors.muted, fontSize: 12, lineHeight: 17 },
  button: { minHeight: Layout.minTouch, justifyContent: 'center', paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  buttonText: { color: Colors.brandStrong, fontSize: 13, fontWeight: '800' },
});
