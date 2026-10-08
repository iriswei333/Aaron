import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Sprout logo + wordmark (web .rail-brand / .welcome-brand).
// tone 'warm' = welcome-flow header (orange wordmark, icon on a soft tile).
export function BrandMark({ size = 30, tone = 'default' }: { size?: number; tone?: 'default' | 'warm' }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="SproutCue">
      <View style={tone === 'warm' ? [styles.tile, { borderRadius: Math.round(size * 0.38) }] : null}>
        <Image source={require('@/assets/images/sproutcue-mark.png')} style={{ width: size, height: size }} contentFit="contain" />
      </View>
      <Text style={[styles.word, tone === 'warm' && styles.wordWarm, { fontSize: Math.round(size * (tone === 'warm' ? 0.66 : 0.75)) }]}>SproutCue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  word: { color: Colors.sprout, fontWeight: '700' },
  wordWarm: { color: Colors.brandDeep, fontWeight: '800' },
  tile: { backgroundColor: Colors.countBg, overflow: 'hidden' },
});
