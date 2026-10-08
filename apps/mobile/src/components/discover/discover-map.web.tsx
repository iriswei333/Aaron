import { discoverKindIcon, discoverKindLabel } from '@sproutcue/shared/discover-view';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

import { KIND_TINT } from './kind-style';
import type { DiscoverMapProps } from './map-types';

// Web preview only: react-native-maps has no web build, so this draws the same
// illustrative neighborhood the web app shows without a Google Maps key.
export function DiscoverMap({ items, selectedId, onSelect, radiusMiles }: DiscoverMapProps) {
  return (
    <View style={styles.map} accessibilityLabel="Illustrative map of filtered Discover results">
      <View style={styles.grid} pointerEvents="none" />
      <View style={styles.water} pointerEvents="none" />
      <View style={[styles.road, { top: '34%', transform: [{ rotate: '-14deg' }] }]} pointerEvents="none" />
      <View style={[styles.road, { top: '68%', transform: [{ rotate: '9deg' }] }]} pointerEvents="none" />
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText}>Illustrative neighborhood · {radiusMiles} mile search</Text>
      </View>
      {items.slice(0, 20).map((item, index) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${item.title}`}
            onPress={() => onSelect(item.id)}
            style={[
              styles.pin,
              { left: `${13 + ((index * 29) % 76)}%`, top: `${18 + ((index * 37) % 65)}%`, backgroundColor: KIND_TINT[item.kind] },
              selected && styles.pinSelected,
            ]}>
            <Text style={styles.pinIcon}>{discoverKindIcon(item.kind)}</Text>
            <Text style={[styles.pinLabel, selected && styles.pinLabelSelected]} numberOfLines={1}>
              {item.distance.label || discoverKindLabel(item.kind)}
            </Text>
          </Pressable>
        );
      })}
      <View style={styles.you} pointerEvents="none">
        <View style={styles.youDot}>
          <Text style={styles.youIcon}>⌖</Text>
        </View>
        <Text style={styles.youLabel}>You</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 360, borderRadius: 21, overflow: 'hidden', backgroundColor: Colors.mapBg, position: 'relative' },
  grid: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.45) 1px, transparent 1px)',
    backgroundSize: '54px 54px',
  } as any,
  water: { position: 'absolute', bottom: '-22%', left: '-10%', width: '46%', height: '58%', backgroundColor: Colors.mapWater, borderTopLeftRadius: 120, borderTopRightRadius: 160, transform: [{ rotate: '10deg' }] },
  road: { position: 'absolute', left: '-10%', width: '120%', height: 18, backgroundColor: Colors.mapRoad },
  label: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  labelText: { color: Colors.muted, fontSize: 11, fontWeight: '800' },
  pin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 118,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    boxShadow: '0 8px 18px rgba(72, 49, 31, .2)',
    zIndex: 3,
  } as any,
  pinSelected: { backgroundColor: Colors.brand, zIndex: 5, boxShadow: '0 0 0 4px rgba(232, 111, 61, .2), 0 10px 22px rgba(72, 49, 31, .22)' } as any,
  pinIcon: { fontSize: 15 },
  pinLabel: { fontSize: 10, fontWeight: '800', color: Colors.ink },
  pinLabelSelected: { color: '#fff' },
  you: { position: 'absolute', right: 18, bottom: 18, alignItems: 'center' },
  youDot: { width: 35, height: 35, borderRadius: 18, borderWidth: 3, borderColor: Colors.brand, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  youIcon: { color: Colors.brandStrong, fontSize: 16, fontWeight: '800' },
  youLabel: { marginTop: 3, backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800', color: Colors.brandStrong },
});
