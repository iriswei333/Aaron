import { discoverKindIcon, discoverKindLabel, discoverMapUrl, discoverScheduleLabel } from '@sproutcue/shared/discover-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import type { DiscoverItem } from '@/lib/discover-data';

import { discoverHeroImage } from './kind-style';
import { openMap, openWebsite } from './open-link';

type Props = { item: DiscoverItem | null; saved: boolean; searchLabel: string; onToggleSave: (item: DiscoverItem) => void; onClose: () => void };

// Web discoverEventDetailModal: photo hero, When / Where facts, summary, save + links.
export function EventDetailSheet({ item, saved, searchLabel, onToggleSave, onClose }: Props) {
  if (!item) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const schedule = discoverScheduleLabel(item) || 'Schedule available on the event website';
  const venue = item.location.venue || 'Venue details available on the event website';
  const address = item.location.address && item.location.address !== venue ? item.location.address : '';
  const mapUrl = discoverMapUrl(item, searchLabel);
  const savable = item.source.resultType !== 'search-link';
  return (
    <Sheet visible onClose={onClose} closeLabel="Close event details">
      <View style={styles.hero}>
        <Image source={discoverHeroImage(item)} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        <LinearGradient colors={['rgba(35,22,16,0.04)', 'rgba(35,22,16,0.62)']} style={StyleSheet.absoluteFill} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{discoverKindIcon(item.kind)} {discoverKindLabel(item.kind)}</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={styles.title}>{item.title}</Text>
      <View style={styles.facts}>
        <Fact icon="◷" label="When" value={schedule} />
        <Fact icon="⌖" label="Where" value={[venue, address, item.distance.label].filter(Boolean).join(' · ')} divider />
      </View>
      <Text style={styles.summary}>{item.summary || `A family-friendly ${discoverKindLabel(item.kind).toLowerCase()} to explore together.`}</Text>
      <View style={styles.actions}>
        {savable ? (
          <Button
            label={saved ? '✓ Saved to plans' : '+ Save to plans'}
            variant="secondary"
            onPress={() => onToggleSave(item)}
            style={[styles.action, styles.saveAction]}
          />
        ) : null}
        {item.href ? <Button label="Visit website ↗" onPress={() => openWebsite(item.href)} style={styles.action} /> : null}
        {mapUrl ? <Button label="Open in map ⌖" variant="secondary" onPress={() => openMap(mapUrl)} style={styles.action} /> : null}
      </View>
    </Sheet>
  );
}

function Fact({ icon, label, value, divider }: { icon: string; label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.fact, divider && styles.factDivider]} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.factIcon}>
        <Text style={styles.factIconText}>{icon}</Text>
      </View>
      <View style={styles.factCopy}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 210, borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.heroBg, justifyContent: 'flex-end', padding: 18 },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: Colors.brandStrong, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: Colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.4, lineHeight: 33 },
  facts: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.line },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  factDivider: { borderTopWidth: 1, borderTopColor: Colors.factDivider },
  factIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  factIconText: { color: Colors.brandStrong, fontSize: 16, fontWeight: '800' },
  factCopy: { flex: 1, gap: 2 },
  factLabel: { color: Colors.brandStrong, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  factValue: { color: Colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  summary: { color: Colors.muted, fontSize: 15, lineHeight: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  action: { flexGrow: 1, flexBasis: '45%' },
  saveAction: { backgroundColor: Colors.brandSoft, borderColor: Colors.brandSoft },
});
