import { playDateCapacity } from '@sproutcue/shared/playdates';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import type { DiscoverItem } from '@/lib/discover-data';

export type ItemHandlers = {
  isSaved: (item: DiscoverItem) => boolean;
  onDetails: (item: DiscoverItem) => void;
  onSelectPlayground: (item: DiscoverItem) => void;
  onNewPlaydate: (item: DiscoverItem) => void;
  onJoin: (item: DiscoverItem) => void;
  onToggleSave: (item: DiscoverItem) => void;
};

// Web discoverActionMarkup: what you can do with each kind of result.
// `detail` = the map selection card (playgrounds offer "+ New playdate" instead of "Select").
export function ItemActions({ item, handlers, detail = false }: { item: DiscoverItem; handlers: ItemHandlers; detail?: boolean }) {
  const data = item.detail || {};
  if (item.kind === 'playground') {
    const live = data.source !== 'starter' && data.source !== 'map-search';
    return (
      <View style={styles.row}>
        <Button label="View details" size="sm" variant="secondary" onPress={() => handlers.onDetails(item)} />
        {detail ? (
          live ? <Button label="＋ New playdate" size="sm" onPress={() => handlers.onNewPlaydate(item)} /> : null
        ) : (
          <Button label="Select" size="sm" onPress={() => handlers.onSelectPlayground(item)} />
        )}
      </View>
    );
  }
  if (item.kind === 'playdate') {
    const view = <Button label={data.isHost ? 'Manage' : 'View details'} size="sm" variant="secondary" onPress={() => handlers.onDetails(item)} />;
    return (
      <View style={styles.row}>
        {view}
        {data.isHost ? (
          <Badge label="You’re hosting" />
        ) : data.isJoined ? (
          <Badge label="You’re going" />
        ) : data.canJoin ? (
          <Button label="Join playdate" size="sm" onPress={() => handlers.onJoin(item)} />
        ) : (
          <Badge label={playDateCapacity(data)} />
        )}
      </View>
    );
  }
  const saved = handlers.isSaved(item);
  const savable = item.source.resultType !== 'search-link';
  return (
    <View style={styles.row}>
      <Button label="View details" size="sm" variant="secondary" onPress={() => handlers.onDetails(item)} />
      {savable ? (
        <Button
          label={saved ? '✓ Saved' : 'Save plan'}
          size="sm"
          variant={saved ? 'secondary' : 'primary'}
          onPress={() => handlers.onToggleSave(item)}
          accessibilityHint={saved ? 'Removes it from your family plans' : 'Adds it to your family plans'}
        />
      ) : null}
    </View>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { alignSelf: 'center', backgroundColor: Colors.brandSoft, borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 8 },
  badgeText: { color: Colors.brandStrong, fontSize: 12, fontWeight: '800' },
});
