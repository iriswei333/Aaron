import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';
import { AiJobsProvider } from '@/lib/ai-jobs';
import { config } from '@/lib/config';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

const sproutCueTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.brand,
    background: Colors.paper,
    card: Colors.surface,
    text: Colors.ink,
    border: Colors.line,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={sproutCueTheme}>
        <SessionProvider>
          <AiJobsProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AiJobsProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Which part of the app is reachable depends on the session, like the web app:
//   signed out                → sign-in
//   signed in, no child yet   → welcome flow (family profile setup)
//   signed in + set up        → tabs (welcome stays reachable for "Edit family details")
function RootNavigator() {
  const { loading, session, onboarded, previewMode, user, profileError } = useSession();
  const signedIn = Boolean(session) || previewMode;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null; // splash screen stays up

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.paper } }}>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          {/* One playdate: from Discover, Family, or a sproutcue://playdate/<id> link. */}
          <Stack.Screen name="playdate/[id]" />
          {/* Play Studio flows: picture books, practice stories, toy play. */}
          <Stack.Screen name="create" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        {/* Deep-link landing for Google sign-in; reachable in every state. */}
        <Stack.Screen name="auth/callback" />
      </Stack>
      {session && !user && profileError ? <ProfileError message={profileError} /> : null}
    </>
  );
}

function ProfileError({ message }: { message: string }) {
  const { refreshProfile, signOut } = useSession();
  return (
    <View style={styles.overlay}>
      <Text style={Type.title}>We couldn’t reach SproutCue</Text>
      <Text style={[Type.bodyMuted, styles.center]}>
        {/fetch|network|timed out/i.test(message)
          ? `You're signed in, but the SproutCue app server at ${config.apiBaseUrl || '(no EXPO_PUBLIC_API_BASE_URL set)'} didn't answer. Make sure the web app is running (npm run dev:web:lan) and that this address is right.`
          : message}
      </Text>
      <Button label="Try again" onPress={refreshProfile} style={styles.centered} />
      <Button label="Sign out" variant="ghost" onPress={signOut} style={styles.centered} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.six,
  },
  center: { textAlign: 'center' },
  centered: { alignSelf: 'center' },
});
