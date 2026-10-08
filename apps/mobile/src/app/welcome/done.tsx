import { buildWelcomeSave } from '@sproutcue/shared/onboarding';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useWelcome } from '@/components/welcome/welcome-context';
import { WelcomeStep } from '@/components/welcome/welcome-step';
import { Colors } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { lookUpAddress } from '@/lib/location';
import { useSession, type SproutCueUser } from '@/lib/session';

export default function DoneScreen() {
  const { draft } = useWelcome();
  const { user, setUser, previewMode } = useSession();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  async function save() {
    if (previewMode) {
      setStatus('Preview mode: add Supabase keys in apps/mobile/.env.local to sign in and save.');
      return;
    }
    setSaving(true);
    setStatus('Saving your family card…');
    try {
      // Same three calls as the web welcome flow (see buildWelcomeSave in @sproutcue/shared).
      const plan = buildWelcomeSave(user, draft);
      let result = await apiRequest<{ user: SproutCueUser }>('/profile', { method: 'PUT', body: plan.profile });
      result = await apiRequest<{ user: SproutCueUser }>('/play-preferences', { method: 'PUT', body: plan.playPreferences });
      if (plan.location) {
        // A new neighborhood: look up its coordinates so weather, Today and Discover keep working.
        // The family's typed words stay as the label; only the map point is added.
        let location: Record<string, unknown> = plan.location;
        try {
          const match = await lookUpAddress(plan.location.address);
          location = { ...plan.location, latitude: match.latitude, longitude: match.longitude };
        } catch {}
        result = await apiRequest<{ user: SproutCueUser }>('/location', { method: 'PUT', body: location });
      }
      setUser(result.user);
      setStatus('');
      router.replace('/');
    } catch (saveError) {
      setStatus(`Could not save setup: ${saveError instanceof Error ? saveError.message : 'please try again.'}`);
      setSaving(false);
    }
  }

  return (
    <WelcomeStep
      step={4}
      title={`You’re in, ${draft.displayName.trim() || 'friend'}! 🎈`}
      lede="Your profile is ready for nearby playdates."
      primaryLabel="Explore my little adventure →"
      onPrimary={save}
      primaryLoading={saving}
      status={status}>
      <Text style={styles.payoff}>Your family card is ready to help you find an easy first connection.</Text>
    </WelcomeStep>
  );
}

const styles = StyleSheet.create({
  payoff: { color: Colors.lede, fontSize: 13, lineHeight: 19 },
});
