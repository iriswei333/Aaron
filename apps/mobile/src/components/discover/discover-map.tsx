import { discoverKindIcon, discoverKindLabel } from '@sproutcue/shared/discover-view';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import { Colors, Radius } from '@/constants/theme';

import { KIND_TINT } from './kind-style';
import { hasPoint, type DiscoverMapProps } from './map-types';

const METERS_PER_MILE = 1609.344;

function regionAround(point: { latitude: number; longitude: number }, radiusMiles: number): Region {
  // Show the whole search circle: diameter in degrees of latitude, with a little margin.
  const latitudeDelta = Math.max(0.02, ((radiusMiles * 2.3) / 69));
  const longitudeDelta = latitudeDelta / Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180));
  return { ...point, latitudeDelta, longitudeDelta };
}

// Native map (Apple Maps on iOS, Google Maps on Android) — web .discover-map with real tiles.
export function DiscoverMap({ items, selectedId, onSelect, center, radiusMiles }: DiscoverMapProps) {
  const mapRef = useRef<MapView>(null);
  const pinned = useMemo(() => items.filter(hasPoint).slice(0, 40), [items]);
  const unpinned = items.length - pinned.length;
  const origin = center ?? (pinned[0] ? { latitude: pinned[0].location.latitude!, longitude: pinned[0].location.longitude! } : null);
  const initialRegion = useMemo(() => (origin ? regionAround(origin, radiusMiles) : undefined), [origin?.latitude, origin?.longitude, radiusMiles]);

  // Custom marker views must track changes briefly so Android draws them, then stop for smooth panning.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 700);
    return () => clearTimeout(timer);
  }, [selectedId, pinned.length]);

  // Re-center when the search location changes.
  useEffect(() => {
    if (initialRegion) mapRef.current?.animateToRegion(initialRegion, 350);
  }, [initialRegion]);

  // Bring the selected pin into view.
  useEffect(() => {
    const selected = pinned.find((item) => item.id === selectedId);
    if (selected) mapRef.current?.animateCamera({ center: { latitude: selected.location.latitude!, longitude: selected.location.longitude! } }, { duration: 300 });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initialRegion) {
    return (
      <View style={[styles.map, styles.empty]}>
        <Text style={styles.emptyIcon}>⌖</Text>
        <Text style={styles.emptyTitle}>Set a search location</Text>
        <Text style={styles.emptyText}>Use your location or enter an address to see adventures on the map.</Text>
      </View>
    );
  }

  return (
    <View style={styles.map} accessibilityLabel="Map of filtered Discover results">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsPointsOfInterests={false}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        userInterfaceStyle="light">
        {center ? (
          <>
            <Circle center={center} radius={radiusMiles * METERS_PER_MILE} strokeColor="rgba(232, 111, 61, 0.45)" fillColor="rgba(232, 111, 61, 0.06)" strokeWidth={1.5} />
            <Marker coordinate={center} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking} accessibilityLabel="Your search location" zIndex={1}>
              <View style={styles.you}>
                <View style={styles.youDot}>
                  <Text style={styles.youIcon}>⌖</Text>
                </View>
                <Text style={styles.youLabel}>You</Text>
              </View>
            </Marker>
          </>
        ) : null}
        {pinned.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.location.latitude!, longitude: item.location.longitude! }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracking}
              zIndex={selected ? 10 : 2}
              accessibilityLabel={`Select ${item.title}`}
              onPress={(event) => {
                event.stopPropagation?.();
                onSelect(item.id);
              }}>
              <View style={[styles.pin, { backgroundColor: KIND_TINT[item.kind] }, selected && styles.pinSelected]}>
                <Text style={styles.pinIcon}>{discoverKindIcon(item.kind)}</Text>
                <Text style={[styles.pinLabel, selected && styles.pinLabelSelected]} numberOfLines={1}>
                  {item.distance.label || discoverKindLabel(item.kind)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText}>
          {radiusMiles} mile search{unpinned > 0 ? ` · ${unpinned} more in List` : ''}
        </Text>
      </View>
    </View>
  );
}

const pinShadow = Platform.select({
  ios: { shadowColor: '#48311f', shadowOpacity: 0.2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 3 },
});

const styles = StyleSheet.create({
  map: { height: 360, borderRadius: 21, overflow: 'hidden', backgroundColor: Colors.mapBg },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 6 },
  emptyIcon: { fontSize: 30, color: Colors.brandStrong },
  emptyTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800' },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center', maxWidth: 240 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 118,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    ...pinShadow,
  },
  pinSelected: { backgroundColor: Colors.brand, borderColor: '#fff' },
  pinIcon: { fontSize: 15 },
  pinLabel: { fontSize: 11, fontWeight: '800', color: Colors.ink },
  pinLabelSelected: { color: '#fff' },
  you: { alignItems: 'center' },
  youDot: { width: 35, height: 35, borderRadius: 18, borderWidth: 3, borderColor: Colors.brand, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  youIcon: { color: Colors.brandStrong, fontSize: 16, fontWeight: '800' },
  youLabel: { marginTop: 3, backgroundColor: '#fff', borderRadius: Radius.pill, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800', color: Colors.brandStrong },
  label: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  labelText: { color: Colors.muted, fontSize: 11, fontWeight: '800' },
});
