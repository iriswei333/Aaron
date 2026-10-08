import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

// "Continue with Google" following Google's sign-in button guidelines:
// white background, light gray border, the standard multicolor G, Roboto-like medium label.
export function GoogleButton({ onPress, loading, disabled }: { onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, inactive && styles.inactive]}>
      {loading ? (
        <ActivityIndicator color={Colors.ink} />
      ) : (
        <>
          <Image source={require('@/assets/images/google-g.png')} style={styles.logo} contentFit="contain" />
          <Text style={styles.label}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: '#dadce0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  pressed: { backgroundColor: '#f8f9fa' },
  inactive: { opacity: 0.55 },
  logo: { width: 20, height: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#1f1f1f' },
});
