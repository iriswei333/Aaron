import { AVAILABILITY_TIME_OPTIONS, toggleValue } from '@sproutcue/shared/onboarding';
import { AVAILABILITY_DAY_OPTIONS } from '@sproutcue/shared/profile-defaults';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip, ChipRow } from '@/components/ui';
import { FieldGroup } from '@/components/welcome/field-group';
import { useWelcome } from '@/components/welcome/welcome-context';
import { WelcomeStep } from '@/components/welcome/welcome-step';
import { Colors, Layout, Radius, Type } from '@/constants/theme';

const DAY_ORDER = AVAILABILITY_DAY_OPTIONS.map(([value]) => value);
const inWeekOrder = (days: string[]) => [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

const DAY_NAMES: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export default function TimeScreen() {
  const { draft, update } = useWelcome();
  const finish = () => router.push('/welcome/done');

  return (
    <WelcomeStep
      step={3}
      title="When are you usually free?"
      lede="Tell us the windows that tend to work. Skip this if your week is still a moving target."
      primaryLabel="Finish setup"
      onPrimary={finish}
      skip={{ label: 'Skip for now', onPress: finish }}>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>Not a commitment — just a shortcut to playdates you could actually make.</Text>
      </View>
      <FieldGroup label="Days">
        <View style={styles.days}>
          {AVAILABILITY_DAY_OPTIONS.map(([value, label]) => {
            const selected = draft.days.includes(value);
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={DAY_NAMES[value]}
                accessibilityState={{ selected }}
                onPress={() => update({ days: inWeekOrder(toggleValue(draft.days, value)) })}
                style={({ pressed }) => [styles.day, selected && styles.daySelected, pressed && !selected && styles.dayPressed]}>
                <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[Type.small, styles.hint]}>
          {draft.days.length ? inWeekOrder(draft.days).map((day) => DAY_NAMES[day]).join(', ') : 'No days selected'}
        </Text>
      </FieldGroup>
      <FieldGroup label="Times" optional="(optional)">
        <ChipRow>
          {AVAILABILITY_TIME_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={draft.times.includes(value)} onPress={() => update({ times: toggleValue(draft.times, value) })} />
          ))}
        </ChipRow>
      </FieldGroup>
    </WelcomeStep>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: 2 },
  notice: { backgroundColor: Colors.noticeBg, borderColor: Colors.noticeBorder, borderWidth: 1, borderRadius: Radius.sm, padding: 14 },
  noticeText: { color: Colors.lede, fontSize: 13, lineHeight: 19 },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    maxWidth: 52,
    height: Layout.minTouch + 4,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: Colors.countBg, borderColor: Colors.brand },
  dayPressed: { backgroundColor: Colors.surfaceSoft },
  dayText: { fontSize: 14, fontWeight: '800', color: Colors.lede },
  dayTextSelected: { color: '#98411f' },
});
