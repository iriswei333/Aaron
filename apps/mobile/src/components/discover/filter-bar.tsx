import { DISCOVER_FILTERS, discoverCountLabel, discoverFilterIsActive } from '@sproutcue/shared/discover-view';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { FilterState } from '@/lib/discover-data';

export type DiscoverView = 'map' | 'list';

type Props = { filter: FilterState; onChoose: (selection: string) => void; count: number; view: DiscoverView; onView: (view: DiscoverView) => void };

// Web .discover-controls: scrolling filter pills, "N ideas to explore", Map / List switch.
export function FilterBar({ filter, onChoose, count, view, onView }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.scroller} accessibilityLabel="Filter Discover results">
        {DISCOVER_FILTERS.map(([value, label]) => {
          const active = discoverFilterIsActive(value, filter);
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => {
                haptics.select();
                onChoose(value);
              }}
              style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && !active && styles.pillPressed]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.toolbar}>
        <Text style={styles.count}>
          <Text style={styles.countStrong}>{discoverCountLabel(count)}</Text> to explore
        </Text>
        <View style={styles.switch} accessibilityRole="tablist">
          {([['map', '◎ Map'], ['list', '☷ List']] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === value }}
              accessibilityLabel={value === 'map' ? 'Map view' : 'List view'}
              onPress={() => {
                if (view !== value) haptics.select();
                onView(value);
              }}
              style={[styles.segment, view === value && styles.segmentActive]}>
              <Text style={[styles.segmentText, view === value && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  scroller: { marginHorizontal: -Layout.gutter },
  filters: { gap: 6, paddingHorizontal: Layout.gutter },
  pill: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    paddingHorizontal: 11,
  },
  pillActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  pillPressed: { backgroundColor: Colors.surfaceSoft },
  pillText: { color: Colors.chipInk, fontSize: 12, fontWeight: '800' },
  pillTextActive: { color: '#fff' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  count: { color: Colors.muted, fontSize: 14, flexShrink: 1 },
  countStrong: { color: Colors.ink, fontWeight: '800' },
  switch: { flexDirection: 'row', backgroundColor: Colors.viewSwitchBg, borderRadius: Radius.pill, padding: 4 },
  segment: { minHeight: 36, minWidth: 68, borderRadius: Radius.pill, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.surface },
  segmentText: { color: Colors.muted, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: Colors.brandStrong },
});
