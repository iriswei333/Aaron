import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

type CardTone = 'default' | 'warm' | 'green' | 'brand';

type CardProps = {
  children: ReactNode;
  tone?: CardTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// White rounded panel with the warm line border and soft shadow (web .panel).
export function Card({ children, tone = 'default', onPress, accessibilityLabel, style }: CardProps) {
  const body = [styles.card, toneStyles[tone], style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...body, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={Type.heading}>{children}</Text>;
}

export function CardText({ children }: { children: ReactNode }) {
  return <Text style={Type.bodyMuted}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.five,
    gap: Spacing.two,
    ...Shadow.card,
  },
  pressed: { opacity: 0.85 },
});

const toneStyles = StyleSheet.create({
  default: {},
  warm: { backgroundColor: Colors.surfaceSoft },
  green: { backgroundColor: '#f2f6ec', borderColor: '#dce7cf' },
  brand: { backgroundColor: Colors.brandSoft, borderColor: '#f3d1b8' },
});
