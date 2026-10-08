import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

// Play Studio flows opened from the Studio tab, Family, and finished-creation links.
export default function CreateLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.paper } }} />;
}
