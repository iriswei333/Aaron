import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Welcome progress (web .welcome-progress): done and current dots are filled orange,
// the current one has a soft ring, the last dot is the ✦ payoff.
export function StepDots({ current, total, label }: { current: number; total: number; label?: string }) {
  return (
    <View style={styles.row} accessibilityLabel={label || (current < total ? `Step ${current} of ${total - 1}` : 'Setup complete')}>
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const filled = step <= current;
        return (
          <View key={step} style={styles.item}>
            {index > 0 ? <View style={styles.line} /> : null}
            <View style={[styles.dot, filled && styles.dotFilled, step === current && styles.dotCurrent]}>
              <Text style={[styles.text, filled && styles.textFilled]}>{step === total ? '✦' : step}</Text>
            </View>
          </View>
        );
      })}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center' },
  line: { width: 30, height: 2, backgroundColor: Colors.progressLine },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  dotCurrent: { shadowColor: Colors.brand, shadowOpacity: 0.25, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, outlineColor: Colors.brandSoft, outlineWidth: 4, outlineStyle: 'solid' },
  text: { fontSize: 11, fontWeight: '800', color: Colors.capsLabel },
  textFilled: { color: '#fff' },
  label: { marginLeft: Spacing.three, fontSize: 12, fontWeight: '800', color: Colors.capsLabel },
});
