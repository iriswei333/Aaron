import { WELCOME_RELATIONSHIP_OPTIONS, PRACTICING_STEP_OPTIONS, toggleValue, validateWelcomeStep } from '@sproutcue/shared/onboarding';
import { FAVORITE_INTEREST_OPTIONS, STORY_LANGUAGE_OPTIONS } from '@sproutcue/shared/profile-defaults';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, ChipRow, TextField } from '@/components/ui';
import { FieldGroup } from '@/components/welcome/field-group';
import { useWelcome } from '@/components/welcome/welcome-context';
import { WelcomeStep } from '@/components/welcome/welcome-step';
import { Spacing } from '@/constants/theme';

export default function WhoScreen() {
  const { draft, update } = useWelcome();
  const [status, setStatus] = useState('');

  function next() {
    const message = validateWelcomeStep(1, draft);
    setStatus(message);
    if (!message) router.push('/welcome/place');
  }

  return (
    <WelcomeStep
      step={1}
      title="Who’s coming to play?"
      lede="Other parents see a family card, not a profile. First names and kid ages only — no last names, no photos of kids required, ever."
      primaryLabel="Continue"
      onPrimary={next}
      status={status}>
      <TextField labelVariant="caps" label="Your first name" value={draft.displayName} onChangeText={(displayName) => update({ displayName })} placeholder="e.g. Priya" autoComplete="given-name" textContentType="givenName" />
      <FieldGroup label="You are…">
        <ChipRow>
          {WELCOME_RELATIONSHIP_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={draft.relationship === value} onPress={() => update({ relationship: value })} />
          ))}
        </ChipRow>
      </FieldGroup>
      <View style={styles.twoUp}>
        <View style={styles.grow}>
          <TextField labelVariant="caps" label="Kid’s name" value={draft.childName} onChangeText={(childName) => update({ childName })} placeholder="A nickname is enough" />
        </View>
        <View style={styles.age}>
          <TextField labelVariant="caps" label="Age in months" value={draft.ageMonths} onChangeText={(ageMonths) => update({ ageMonths: ageMonths.replace(/[^0-9]/g, '').slice(0, 3) })} placeholder="24" keyboardType="number-pad" />
        </View>
      </View>
      <FieldGroup label="Story language">
        <ChipRow>
          {STORY_LANGUAGE_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={draft.storyLanguage === value} onPress={() => update({ storyLanguage: value })} />
          ))}
        </ChipRow>
      </FieldGroup>
      <FieldGroup label="What do they love?">
        <ChipRow>
          {FAVORITE_INTEREST_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={draft.interests.includes(value)} onPress={() => update({ interests: toggleValue(draft.interests, value) })} />
          ))}
        </ChipRow>
      </FieldGroup>
      <FieldGroup label="Little steps they’re practicing" optional="(choose any)">
        <ChipRow>
          {PRACTICING_STEP_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={draft.practicingSteps.includes(value)} onPress={() => update({ practicingSteps: toggleValue(draft.practicingSteps, value) })} />
          ))}
        </ChipRow>
      </FieldGroup>
    </WelcomeStep>
  );
}

const styles = StyleSheet.create({
  twoUp: { flexDirection: 'row', gap: Spacing.three },
  grow: { flex: 1 },
  age: { width: 130 },
});
