import { StyleSheet, Text, View } from 'react-native';

import { Colors, Type } from '@/constants/theme';

// Web .discover-heading (phone layout): eyebrow, big title, lede. Weather lives on Today.
export function DiscoverHeading({ childName }: { childName: string }) {
  return (
    <View>
      <Text style={Type.eyebrow}>Out in the world</Text>
      <Text accessibilityRole="header" style={styles.title}>Find your next adventure</Text>
      <Text style={styles.lede}>Places, playmates, and little discoveries for {childName}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -2, lineHeight: 40, marginTop: 8, marginBottom: 12 },
  lede: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
});
