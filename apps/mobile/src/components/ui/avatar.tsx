import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AvatarColors, Colors } from '@/constants/theme';

type AvatarProps = {
  name?: string;
  imageUri?: string | null;
  size?: number;
  /** Rounded square (web .family-child-avatar) instead of a circle. */
  shape?: 'circle' | 'rounded';
  color?: string;
};

export function avatarColorFor(name = '') {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AvatarColors[hash % AvatarColors.length];
}

export function initialsFor(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

// Initial-letter avatar with an optional photo; first names only, like the web family card.
export function Avatar({ name = '', imageUri, size = 40, shape = 'circle', color }: AvatarProps) {
  const radius = shape === 'circle' ? size / 2 : size * 0.32;
  const frame = { width: size, height: size, borderRadius: radius };
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
      style={[styles.base, frame, { backgroundColor: color || avatarColorFor(name), borderWidth: size >= 64 ? 4 : 2 }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={[frame, StyleSheet.absoluteFill]} contentFit="cover" />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>{initialsFor(name)}</Text>
      )}
    </View>
  );
}

export function AvatarStack({ names, size = 32 }: { names: string[]; size?: number }) {
  return (
    <View style={styles.stack} accessibilityLabel={`${names.length} families`}>
      {names.map((name, index) => (
        <View key={`${name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -size * 0.28 }}>
          <Avatar name={name} size={size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderColor: Colors.surface, overflow: 'hidden' },
  initial: { color: '#fff', fontWeight: '800' },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
