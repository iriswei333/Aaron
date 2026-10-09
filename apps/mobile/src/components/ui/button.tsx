import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Layout, Radius, Shadow, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** 'pill' = fully rounded (web .welcome-primary). */
  shape?: 'rounded' | 'pill';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Light tap on press (default). Turn off for buttons that trigger their own success/error feedback. */
  haptic?: boolean;
};

// Primary = orange filled (web .rail-create / .welcome-primary), secondary = white with warm border,
// ghost = text button, danger = destructive actions such as sign out.
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  loading = false,
  disabled = false,
  fullWidth = false,
  leading,
  trailing,
  accessibilityHint,
  style,
  haptic = true,
}: ButtonProps) {
  const inactive = disabled || loading;
  const tint = variant === 'primary' ? '#fff' : variant === 'danger' ? Colors.dangerWeb : Colors.brandStrong;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={
        onPress &&
        (() => {
          if (haptic) (variant === 'primary' || variant === 'danger' ? haptics.tap : haptics.select)();
          onPress();
        })
      }
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        shape === 'pill' && styles.pill,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !inactive && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        inactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <View style={styles.content}>
          {leading}
          <Text style={[styles.label, size === 'sm' && styles.labelSmall, { color: tint }]} numberOfLines={1}>
            {label}
          </Text>
          {trailing}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  small: { minHeight: Layout.minTouch, paddingHorizontal: Spacing.four, borderRadius: Radius.sm },
  fullWidth: { alignSelf: 'stretch' },
  pill: { borderRadius: Radius.pill },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  primary: { backgroundColor: Colors.brand, ...Shadow.button },
  primaryPressed: { backgroundColor: Colors.brandStrong },
  secondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.brandBorder },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: Spacing.three },
  danger: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.dangerBorder },
  pressed: { backgroundColor: Colors.brandSoft },
  inactive: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '800' },
  labelSmall: { fontSize: 14 },
});
