import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

type ChipTone = 'default' | 'brand' | 'green' | 'sun';

type ChipProps = {
  label: string;
  tone?: ChipTone;
  /** Makes the chip a toggle button (web .welcome-chip). */
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

// Static tags (web .family-chip-list span, .pinned-tags em) or selectable chips (web .welcome-chip).
export function Chip({ label, tone = 'default', selected, onPress, disabled }: ChipProps) {
  if (!onPress) {
    return (
      <View style={[styles.chip, toneStyles[tone].chip]}>
        <Text style={[styles.text, toneStyles[tone].text]}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        styles.selectable,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.text, styles.selectableText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 13, fontWeight: '700' },
  selectable: {
    minHeight: Layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.surface,
    borderColor: Colors.inputBorder,
    borderWidth: 1.5,
  },
  // web .welcome-chip / .welcome-chip.selected
  selectableText: { color: Colors.lede, fontSize: 14, fontWeight: '800' },
  selected: { backgroundColor: Colors.countBg, borderColor: Colors.brand },
  selectedText: { color: '#98411f' },
  pressed: { backgroundColor: Colors.surfaceSoft },
  disabled: { opacity: 0.5 },
});

const toneStyles = {
  default: StyleSheet.create({ chip: { backgroundColor: Colors.surface, borderColor: Colors.chipBorder }, text: { color: Colors.chipInk } }),
  brand: StyleSheet.create({ chip: { backgroundColor: Colors.brandSoft, borderColor: Colors.brandSoft }, text: { color: Colors.brandStrong } }),
  green: StyleSheet.create({ chip: { backgroundColor: Colors.greenSoft, borderColor: Colors.greenSoft }, text: { color: Colors.greenInk } }),
  sun: StyleSheet.create({ chip: { backgroundColor: Colors.sunSoft, borderColor: Colors.sunSoft }, text: { color: Colors.sunInk } }),
};
