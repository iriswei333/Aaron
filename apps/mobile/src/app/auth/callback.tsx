import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { completeSignInFromUrl, isAuthPopup } from '@/lib/oauth';

// Landing route for sproutcue://auth/callback. Usually the in-app browser hands the URL
// straight back to signInWithGoogle(); on some Android devices the OS opens this route instead,
// and in the browser preview the sign-in popup lands here (and only hands the URL back).
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const url = Linking.useURL();
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    // Inside the browser sign-in popup the main window finishes sign-in and closes this
    // window; exchanging the code here too would race it and use up the one-time code.
    if (isAuthPopup()) return;
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => typeof value === 'string') as [string, string][],
    ).toString();
    const callbackUrl = url && url.includes('auth/callback') ? url : query ? `sproutcue://auth/callback?${query}` : '';
    if (!callbackUrl) return;
    started.current = true;
    completeSignInFromUrl(callbackUrl).then((result) => {
      if (result.status === 'error') setMessage(result.message);
      else router.replace('/');
    });
  }, [params, url]);

  return (
    <View style={styles.page}>
      {message ? (
        <>
          <Text style={Type.title}>Sign-in didn’t finish</Text>
          <Text style={[Type.bodyMuted, styles.center]}>{message}</Text>
          <Button label="Back to sign in" onPress={() => router.replace('/')} style={styles.centered} />
        </>
      ) : (
        <>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={Type.bodyMuted}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.six, backgroundColor: Colors.paper },
  center: { textAlign: 'center' },
  centered: { alignSelf: 'center' },
});
