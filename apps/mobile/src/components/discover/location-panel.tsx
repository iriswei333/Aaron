import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';

type Props = { label: string; status: string; locating: boolean; onLocate: () => void; onAddress: () => void };

// Web .discover-location-panel: where results are searched from, plus the two ways to change it.
export function LocationPanel({ label, status, locating, onLocate, onAddress }: Props) {
  return (
    <LinearGradient colors={[Colors.locationFrom, Colors.locationTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
      <View style={styles.copy}>
        <View style={styles.tile}>
          <Text style={styles.tileIcon}>⌖</Text>
        </View>
        <View style={styles.text}>
          <Text style={Type.eyebrow}>Your search location</Text>
          <Text style={styles.label} numberOfLines={2}>{label}</Text>
          <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button label="⌖ Use my location" size="sm" onPress={onLocate} loading={locating} style={styles.button} accessibilityHint="Asks for location permission and searches near you" />
        <Button label="Input address" size="sm" variant="secondary" onPress={onAddress} style={styles.button} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 20, borderWidth: 1, borderColor: Colors.locationBorder, padding: Spacing.four, gap: Spacing.four },
  copy: { flexDirection: 'row', gap: Spacing.three },
  tile: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { fontSize: 20, color: Colors.brandStrong, fontWeight: '800' },
  text: { flex: 1, gap: 3 },
  label: { color: Colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  status: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1, alignSelf: 'stretch', paddingHorizontal: Spacing.two },
});

// Once a location is set the panel shrinks to one line. It's changed from the Today
// location chip or Family → Edit family details, so this line isn't a button.
export function LocationSummary({ label, radiusMiles }: { label: string; radiusMiles: number }) {
  return (
    <View style={summary.row} accessible accessibilityLabel={`Searching within ${radiusMiles} miles of ${label}. Change it from the location chip on Today or in Family details.`}>
      <Text style={summary.icon}>⌖</Text>
      <View style={summary.copy}>
        <Text style={summary.label} numberOfLines={1}>
          Near <Text style={summary.strong}>{label}</Text> · {radiusMiles} mi
        </Text>
        <Text style={summary.hint} numberOfLines={1}>Change it from Today or Family details</Text>
      </View>
    </View>
  );
}

const summary = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.locationTo, borderWidth: 1, borderColor: Colors.locationBorder, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  icon: { color: Colors.brandStrong, fontSize: 18, fontWeight: '800' },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  label: { color: Colors.muted, fontSize: 14 },
  strong: { color: Colors.ink, fontWeight: '800' },
  hint: { color: Colors.faint, fontSize: 12 },
});
