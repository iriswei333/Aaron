import { Stack } from 'expo-router';

import { WelcomeProvider } from '@/components/welcome/welcome-context';
import { Colors } from '@/constants/theme';

// Welcome flow (family profile setup): who → where → when → you're in.
// Each step is its own screen, so the native back gesture works.
export default function WelcomeLayout() {
  return (
    <WelcomeProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.paper } }} />
    </WelcomeProvider>
  );
}
