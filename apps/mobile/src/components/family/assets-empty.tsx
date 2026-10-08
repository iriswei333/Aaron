import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Web .family-assets-empty: dashed gradient box with a ✦ tile.
export function AssetsEmpty() {
  return (
    <LinearGradient colors={['#fff7ee', '#f4f8e8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.box}>
      <View style={styles.tile}>
        <Text style={styles.icon}>✦</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>No AI creations yet</Text>
        <Text style={styles.text}>Make a picture book or turn a familiar toy into a new game.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: Spacing.five, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e4cdb8' },
  tile: { width: 48, height: 48, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  icon: { color: Colors.assetInk, fontSize: 22 },
  copy: { flex: 1, gap: 3 },
  title: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  text: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
});
