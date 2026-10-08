import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

type ImageHeroProps = {
  source: any;
  /** 'up' = dark at the bottom (web .today-plan-feature), 'left' = dark on the left (web .today-adventure-card). */
  shade: 'up' | 'left';
  minHeight: number;
  radius: number;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// Photo card with a dark gradient so white text stays readable.
export function ImageHero({ source, shade, minHeight, radius, children, onPress, accessibilityLabel, style }: ImageHeroProps) {
  const body = (
    <>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      {shade === 'up' ? (
        <LinearGradient
          colors={['rgba(45,27,19,0.16)', 'rgba(45,27,19,0.5)', 'rgba(35,22,16,0.9)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={['rgba(48,31,19,0.86)', 'rgba(48,31,19,0.54)', 'rgba(48,31,19,0.08)']}
          locations={[0, 0.56, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.content}>{children}</View>
    </>
  );
  const frame = [styles.frame, { minHeight, borderRadius: radius }, style];
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...frame, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: Colors.featureBase,
    justifyContent: 'flex-end',
    shadowColor: '#4a2c1f',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  content: { padding: 22 },
  pressed: { opacity: 0.94 },
});
