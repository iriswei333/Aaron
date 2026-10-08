import { discoverEmptyCopy, discoverKindIcon, discoverKindLabel, discoverScheduleLabel } from '@sproutcue/shared/discover-view';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Shadow, Type } from '@/constants/theme';
import type { DiscoverItem, FilterState } from '@/lib/discover-data';

import { ItemActions, type ItemHandlers } from './item-actions';

type Props = { item: DiscoverItem | null; handlers: ItemHandlers; filter: FilterState; loading: boolean };

// Web .discover-selection: the item picked on the map.
export function SelectionCard({ item, handlers, filter, loading }: Props) {
  if (!item) return <EmptyResults filter={filter} loading={loading} />;
  const schedule = discoverScheduleLabel(item);
  const place = item.location.venue || item.location.address || 'Nearby';
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.icon}>
        <Text style={styles.iconText}>{discoverKindIcon(item.kind)}</Text>
      </View>
      <Text style={Type.eyebrow}>Selected {discoverKindLabel(item.kind)}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{[schedule, place, item.distance.label].filter(Boolean).join(' · ')}</Text>
      <Text style={styles.summary}>{item.summary || `A family-friendly ${discoverKindLabel(item.kind).toLowerCase()} near you.`}</Text>
      <View style={styles.actions}>
        <ItemActions item={item} handlers={handlers} detail />
      </View>
      <Text style={styles.hint}>Tap a pin on the map, or switch to the list for more details.</Text>
    </View>
  );
}

export function EmptyResults({ filter, loading }: { filter: FilterState; loading: boolean }) {
  const copy = discoverEmptyCopy({ ...filter, loading });
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>⌖</Text>
      <Text style={styles.emptyTitle}>{copy.title}</Text>
      <Text style={styles.emptyBody}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 21, padding: 22, ...Shadow.card },
  icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  iconText: { fontSize: 24 },
  title: { color: Colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -1, lineHeight: 28, marginTop: 7, marginBottom: 10 },
  meta: { color: Colors.muted, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  summary: { color: Colors.muted, fontSize: 15, lineHeight: 23, marginTop: 8 },
  actions: { marginTop: 18, marginBottom: 14 },
  hint: { color: Colors.selectionHint, fontSize: 12, lineHeight: 17 },
  empty: { alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.line, borderRadius: 20, paddingHorizontal: 30, paddingVertical: 36 },
  emptyIcon: { fontSize: 28, color: Colors.brandStrong },
  emptyTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: Colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
