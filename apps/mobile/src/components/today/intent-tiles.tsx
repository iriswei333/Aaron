import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export type Intent = { key: string; icon: string; label: string; detail: string; onPress: () => void };

// Web .today-intents (phone layout): three equal tiles, icon tile above a short label; first is active.
export function IntentTiles({ intents }: { intents: Intent[] }) {
  return (
    <View style={styles.row} accessibilityLabel="Choose what your family needs">
      {intents.map((intent, index) => (
        <Pressable
          key={intent.key}
          accessibilityRole="button"
          accessibilityLabel={`${intent.label}. ${intent.detail}`}
          onPress={() => {
            haptics.tap();
            intent.onPress();
          }}
          style={({ pressed }) => [styles.tile, (index === 0 || pressed) && styles.active]}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>{intent.icon}</Text>
          </View>
          <Text style={styles.label}>{intent.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 14,
  },
  active: { backgroundColor: Colors.intentActiveBg, borderColor: Colors.intentActiveBorder },
  icon: { width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: Colors.brandStrong, fontSize: 18 },
  label: { color: Colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
});
