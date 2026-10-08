import { discoverKindIcon, discoverKindLabel, discoverScheduleLabel } from '@sproutcue/shared/discover-view';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Shadow } from '@/constants/theme';
import type { DiscoverItem } from '@/lib/discover-data';

import { ItemActions, type ItemHandlers } from './item-actions';
import { discoverImage } from './kind-style';

// Web .discover-result-card, stacked for phones: photo | copy, actions underneath.
export function ResultCard({ item, handlers }: { item: DiscoverItem; handlers: ItemHandlers }) {
  const schedule = discoverScheduleLabel(item);
  const place = item.location.venue || item.location.address || 'Nearby';
  const image = discoverImage(item);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${discoverKindLabel(item.kind)}: ${item.title}`}
        accessibilityHint="Opens details"
        onPress={() => handlers.onDetails(item)}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}>
        {image ? (
          <Image source={image} style={styles.image} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.iconTile}>
            <Text style={styles.icon}>{discoverKindIcon(item.kind)}</Text>
          </View>
        )}
        <View style={styles.copy}>
          <Text style={styles.kind} numberOfLines={1}>
            {discoverKindLabel(item.kind)}
            {schedule ? ` · ${schedule}` : ''}
          </Text>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.summary} numberOfLines={2}>{item.summary || place}</Text>
          <Text style={styles.place} numberOfLines={1}>{[place, item.distance.label].filter(Boolean).join(' · ')}</Text>
        </View>
      </Pressable>
      <ItemActions item={item} handlers={handlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 20, padding: 12, gap: 12, ...Shadow.card },
  top: { flexDirection: 'row', gap: 14, alignItems: 'center', borderRadius: 14 },
  pressed: { opacity: 0.75 },
  image: { width: 74, height: 74, borderRadius: 14, backgroundColor: Colors.heroBg },
  iconTile: { width: 74, height: 74, borderRadius: 14, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 26 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  kind: { color: Colors.brandStrong, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { color: Colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 20 },
  summary: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  place: { color: Colors.resultPlace, fontSize: 12 },
});
