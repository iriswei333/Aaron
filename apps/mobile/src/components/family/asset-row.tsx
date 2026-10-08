import { familyAssetRow } from '@sproutcue/shared/family-profile';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type AssetEntry = { kind: 'book' | 'toy' | 'story'; item: any };

const ICONS = { book: '▤', toy: '▧', story: '✦' } as const;

// Web .family-asset-row: icon tile, title + details, trailing "Story →" / "Play idea →" pill or arrow.
export function AssetRow({ entry, childName, onPress }: { entry: AssetEntry; childName: string; onPress: () => void }) {
  const row = familyAssetRow(entry, childName);
  const tile = entry.kind === 'story' ? styles.storyTile : entry.kind === 'toy' ? styles.toyTile : styles.bookTile;
  const ink = entry.kind === 'story' ? Colors.storyInk : entry.kind === 'toy' ? Colors.toyInk : Colors.assetInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.title}. ${row.subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.tile, tile]}>
        <Text style={[styles.icon, { color: ink }]}>{ICONS[entry.kind]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{row.title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{row.subtitle}</Text>
      </View>
      {row.action ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{row.action}</Text>
        </View>
      ) : (
        <Text style={styles.arrow}>→</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: Spacing.three,
    minHeight: 68,
    backgroundColor: Colors.rowBg,
    borderWidth: 1,
    borderColor: Colors.rowBorder,
    borderRadius: 16,
  },
  pressed: { backgroundColor: Colors.previewPanel, borderColor: Colors.rowBorderPressed },
  tile: { width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookTile: { backgroundColor: Colors.assetTile },
  toyTile: { backgroundColor: Colors.toyTile },
  storyTile: { backgroundColor: Colors.storyTile },
  icon: { fontSize: 20 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  subtitle: { color: Colors.muted, fontSize: 12 },
  pill: { backgroundColor: Colors.greenSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  pillText: { color: Colors.greenInk, fontSize: 11, fontWeight: '800' },
  arrow: { color: Colors.assetInk, fontSize: 16, fontWeight: '800' },
});
