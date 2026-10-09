import { discoverKindIcon, discoverKindLabel } from '@sproutcue/shared/discover-view';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import { Colors, Radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

import { KIND_TINT } from './kind-style';
import { hasPoint, type DiscoverMapProps } from './map-types';

const METERS_PER_MILE = 1609.344;

// The family's location and search radius only limit playgrounds and playdates.
// Family events and story times are shown wherever they are.
const LOCATION_BOUND_KINDS = new Set(['playground', 'playdate']);
const MAX_LOCAL_PINS = 40;
// Every event and story time in the current filter gets a pin; this only guards against a runaway feed.
const MAX_EVENT_PINS = 250;
// Ignore far-off outliers (a mis-geocoded venue) when framing the first view.
const FRAME_LIMIT_MILES = 75;

type Point = { latitude: number; longitude: number };

function milesBetween(a: Point, b: Point) {
  const dLat = (b.latitude - a.latitude) * 69;
  const dLng = (b.longitude - a.longitude) * 69 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** First view: the whole search circle plus every event / story time pin near it. */
function initialRegionFor(origin: Point, radiusMiles: number, eventPoints: Point[]): Region {
  const radiusLat = radiusMiles / 69;
  const radiusLng = radiusLat / Math.max(0.2, Math.cos((origin.latitude * Math.PI) / 180));
  let minLat = origin.latitude - radiusLat;
  let maxLat = origin.latitude + radiusLat;
  let minLng = origin.longitude - radiusLng;
  let maxLng = origin.longitude + radiusLng;
  eventPoints
    .filter((point) => milesBetween(origin, point) <= FRAME_LIMIT_MILES)
    .forEach((point) => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.15),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.15),
  };
}

// Native map (Apple Maps on iOS, Google Maps on Android) — web .discover-map with real tiles.
export function DiscoverMap({ items, selectedId, onSelect, center, radiusMiles, placing = 0 }: DiscoverMapProps) {
  const mapRef = useRef<MapView>(null);
  const pinned = useMemo(() => {
    const withPoint = items.filter(hasPoint);
    return [
      ...withPoint.filter((item) => LOCATION_BOUND_KINDS.has(item.kind)).slice(0, MAX_LOCAL_PINS),
      ...withPoint.filter((item) => !LOCATION_BOUND_KINDS.has(item.kind)).slice(0, MAX_EVENT_PINS),
    ];
  }, [items]);
  const unpinned = items.length - pinned.length;
  const eventPoints = useMemo(
    () => pinned.filter((item) => !LOCATION_BOUND_KINDS.has(item.kind)).map((item) => ({ latitude: item.location.latitude!, longitude: item.location.longitude! })),
    [pinned],
  );
  const origin = center ?? eventPoints[0] ?? (pinned[0] ? { latitude: pinned[0].location.latitude!, longitude: pinned[0].location.longitude! } : null);
  // Re-frame only when the location, radius or set of event pins changes (not on every selection).
  const eventKey = eventPoints.map((point) => `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`).join('|');
  const initialRegion = useMemo(
    () => (origin ? initialRegionFor(origin, center ? radiusMiles : 0, eventPoints) : undefined),
    [origin?.latitude, origin?.longitude, radiusMiles, eventKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Custom marker views must track changes briefly so Android draws them, then stop for smooth panning.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 700);
    return () => clearTimeout(timer);
  }, [selectedId, pinned.length]);

  // Re-frame when the location, filter or event pins change — but not pin by pin while venues
  // are still being placed (that would make the map jump); once when placing finishes.
  useEffect(() => {
    if (initialRegion && placing === 0) mapRef.current?.animateToRegion(initialRegion, 350);
  }, [initialRegion, placing === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the selected pin into view.
  useEffect(() => {
    const selected = pinned.find((item) => item.id === selectedId);
    if (selected) mapRef.current?.animateCamera({ center: { latitude: selected.location.latitude!, longitude: selected.location.longitude! } }, { duration: 300 });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initialRegion) {
    return (
      <View style={[styles.map, styles.empty]}>
        <Text style={styles.emptyIcon}>⌖</Text>
        <Text style={styles.emptyTitle}>Nothing on the map yet</Text>
        <Text style={styles.emptyText}>Family events and story times appear here as they load. Add your location in Family details to see playgrounds and playdates nearby.</Text>
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
                if (item.id !== selectedId) haptics.select();
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
          {center ? `${radiusMiles} mile search` : 'Events & story times'}
          {placing > 0 ? ` · placing ${placing} on the map…` : unpinned > 0 ? ` · ${unpinned} without an address (see List)` : ''}
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
