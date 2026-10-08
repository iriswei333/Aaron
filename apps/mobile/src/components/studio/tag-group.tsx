import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

// Web .practice-tag-group: a numbered legend and purple toggle chips.
export function TagGroup({ legend, note, children }: { legend: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.group} accessibilityRole="none">
      <Text style={styles.legend}>
        {legend}
        {note ? <Text style={styles.note}>  {note}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

export function TagChips({ options, isSelected, onToggle, disabled }: { options: { id: string; label: string }[]; isSelected: (id: string) => boolean; onToggle: (id: string) => void; disabled?: boolean }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = isSelected(option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onToggle(option.id)}
            style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && !selected && styles.chipPressed]}>
            <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Web .practice-story-language: radio cards with a title and a line of detail. */
export function ChoiceCards<T extends string>({ options, value, onChange, disabled }: { options: { id: T; label: string; detail?: string }[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  return (
    <View style={styles.cards} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.id)}
            style={[styles.card, selected && styles.cardOn]}>
            <Text style={styles.cardTitle}>{option.label}</Text>
            {option.detail ? <Text style={styles.cardDetail}>{option.detail}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  legend: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  note: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, justifyContent: 'center', borderRadius: Radius.pill, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#f2f0fa', paddingHorizontal: 12 },
  chipOn: { backgroundColor: Colors.storyAccent, borderColor: Colors.storyAccent },
  chipPressed: { backgroundColor: '#e6e2f5' },
  chipText: { color: Colors.storyAccent, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { flexGrow: 1, flexBasis: '30%', minHeight: 64, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.sceneBg, paddingHorizontal: 13, paddingVertical: 11, gap: 3 },
  cardOn: { borderColor: Colors.storyAccent, backgroundColor: '#f5f3fc' },
  cardTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  cardDetail: { color: Colors.muted, fontSize: 12, lineHeight: 16 },
});
