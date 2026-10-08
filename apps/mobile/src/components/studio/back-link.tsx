import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Layout } from '@/constants/theme';

// Web .studio-back: "← Back to Play Studio".
export function BackLink({ label = 'Back to Play Studio', fallback = '/studio' }: { label?: string; fallback?: Href }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} hitSlop={8} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Text style={styles.text}>← {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: Layout.minTouch, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  text: { color: Colors.brandStrong, fontSize: 15, fontWeight: '800' },
});
