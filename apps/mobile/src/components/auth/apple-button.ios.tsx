import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { isAppleSignInAvailable } from '@/lib/apple-auth';

export type AppleButtonProps = { onPress: () => void; loading?: boolean; disabled?: boolean };

// Apple's own "Continue with Apple" button (required look per Apple's guidelines).
// iOS only — apple-button.tsx renders nothing on Android and web.
export function AppleButton({ onPress, loading, disabled }: AppleButtonProps) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((value) => active && setAvailable(value));
    return () => {
      active = false;
    };
  }, []);
  if (!available) return null;

  const inactive = disabled || loading;
  return (
    <View pointerEvents={inactive ? 'none' : 'auto'} accessibilityState={{ disabled: inactive, busy: loading }} style={inactive && styles.inactive}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={Radius.control}
        style={styles.button}
        onPress={onPress}
      />
      {loading ? <ActivityIndicator color="#ffffff" style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

export { signInWithApple } from '@/lib/apple-auth';

const styles = StyleSheet.create({
  button: { width: '100%', height: 50 },
  inactive: { opacity: 0.55 },
});
