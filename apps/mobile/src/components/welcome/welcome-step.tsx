import { parseAgeMonths } from '@sproutcue/shared/onboarding';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand/brand-mark';
import { FamilyCardPreview } from '@/components/family/family-card';
import { Button, Screen, StepDots } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';

import { useWelcome } from './welcome-context';

type WelcomeStepProps = {
  step: number; // 1–4 (4 = "You're in!")
  eyebrow?: string;
  title: string;
  lede: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  skip?: { label: string; onPress: () => void };
  status?: string;
};

// Mirrors the web welcome screen (web .welcome-shell): brand row, progress, heading, form,
// actions, then the live family-card preview — on every step, like the web's phone layout.
export function WelcomeStep({ step, eyebrow, title, lede, children, primaryLabel, onPrimary, primaryLoading, skip, status }: WelcomeStepProps) {
  const { draft } = useWelcome();
  const canGoBack = step > 1 && router.canGoBack();
  return (
    <Screen
      header={
        <View style={styles.top}>
          <BrandMark size={32} tone="warm" />
          <Text style={styles.time}>Takes about 2 minutes</Text>
        </View>
      }
      after={
        <FamilyCardPreview
          parentName={draft.displayName.trim()}
          childName={draft.childName.trim()}
          ageMonths={parseAgeMonths(draft.ageMonths)}
          neighborhood={draft.neighborhood.trim()}
          days={draft.days}
        />
      }>
      <StepDots current={step} total={4} label={`Step ${Math.min(step, 3)} of 3${step === 4 ? ' · Done' : ''}`} />
      <View style={styles.heading}>
        <Text style={Type.eyebrow}>{eyebrow || (step === 4 ? 'Your first connection' : 'Welcome to SproutCue')}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.lede}>{lede}</Text>
      </View>
      {children}
      <View style={styles.actions}>
        {canGoBack ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.textButton}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
        ) : null}
        <Button label={primaryLabel} onPress={onPrimary} loading={primaryLoading} shape="pill" style={styles.primary} />
        {skip ? (
          <Pressable accessibilityRole="button" onPress={skip.onPress} hitSlop={8} style={[styles.textButton, styles.skip]}>
            <Text style={[styles.back, styles.skipText]}>{skip.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.six },
  time: { color: '#7a7263', fontSize: 12, fontWeight: '800' },
  heading: { gap: Spacing.two, marginTop: Spacing.five },
  title: { color: '#263229', fontSize: 32, fontWeight: '800', lineHeight: 34, letterSpacing: -0.8 },
  lede: { color: Colors.lede, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.five },
  primary: { flexGrow: 0 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  back: { color: Colors.capsLabel, fontSize: 13, fontWeight: '800' },
  skip: { marginLeft: 'auto' },
  skipText: { textDecorationLine: 'underline' },
  status: { color: Colors.status, fontSize: 13, marginTop: Spacing.three },
});
