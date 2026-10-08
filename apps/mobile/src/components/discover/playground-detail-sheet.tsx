import { discoverMapUrl, playgroundRecommendationReason } from '@sproutcue/shared/discover-view';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { TODAY_IMAGES } from '@/components/today/images';
import { Button, Chip, ChipRow, Sheet } from '@/components/ui';
import { Colors, Radius, Type } from '@/constants/theme';
import type { DiscoverItem } from '@/lib/discover-data';

import { openMap } from './open-link';

type Props = { item: DiscoverItem | null; indoorWeather: boolean; onNewPlaydate: (item: DiscoverItem) => void; onClose: () => void };

// Web playground detail modal: photo, type + distance, overview, highlights, why it's recommended.
export function PlaygroundDetailSheet({ item, indoorWeather, onNewPlaydate, onClose }: Props) {
  if (!item) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const data = item.detail || {};
  const live = data.source !== 'starter' && data.source !== 'map-search';
  const highlights: string[] = Array.isArray(data.highlights) ? data.highlights.slice(0, 6) : [];
  const mapUrl = data.href || discoverMapUrl(item);
  return (
    <Sheet
      visible
      onClose={onClose}
      closeLabel="Close playground details"
      footer={
        <>
          {live ? <Button label="＋ New playdate" fullWidth onPress={() => onNewPlaydate(item)} /> : null}
          {mapUrl ? <Button label="Open map" variant="secondary" fullWidth onPress={() => openMap(mapUrl)} /> : null}
        </>
      }>
      <View>
        <Text style={Type.eyebrow}>Playground details</Text>
        <Text accessibilityRole="header" style={styles.title}>{item.title}</Text>
      </View>
      <Image source={item.imageUrl ? { uri: item.imageUrl } : TODAY_IMAGES.playground} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors />
      <Text style={styles.meta}>{[data.type, data.distance || item.distance.label].filter(Boolean).join(' • ')}</Text>
      <Text style={styles.overview}>{data.overview || `${item.title} is a nearby ${String(data.type || 'play').toLowerCase()} option.`}</Text>
      {highlights.length ? (
        <ChipRow>
          {highlights.map((highlight) => (
            <Chip key={highlight} label={highlight} tone="green" />
          ))}
        </ChipRow>
      ) : null}
      <View style={styles.why}>
        <Text style={styles.whyTitle}>Why it’s recommended</Text>
        <Text style={styles.whyText}>{playgroundRecommendationReason(data, indoorWeather)}</Text>
      </View>
      {data.best || data.weather ? <Text style={Type.small}>{[data.best, data.weather ? `Best: ${data.weather}` : ''].filter(Boolean).join(' • ')}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1.2, lineHeight: 32, marginTop: 6 },
  image: { height: 190, borderRadius: Radius.card, backgroundColor: Colors.heroBg },
  meta: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  overview: { color: Colors.muted, fontSize: 15, lineHeight: 23 },
  why: { backgroundColor: Colors.brandSoft, borderRadius: Radius.md, padding: 14, gap: 4 },
  whyTitle: { color: Colors.brandStrong, fontSize: 13, fontWeight: '800' },
  whyText: { color: Colors.ink, fontSize: 14, lineHeight: 20 },
});
