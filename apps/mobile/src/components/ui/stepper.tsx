import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

type StepperProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  label: string;
};

// − value + control (replaces the web range slider without a native slider dependency).
export function Stepper({ value, min, max, step = 1, format = String, onChange, label }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => set(value + (event.nativeEvent.actionName === 'increment' ? step : -step))}>
      <StepButton symbol="−" label={`Decrease ${label}`} disabled={value <= min} onPress={() => set(value - step)} />
      <Text style={styles.value}>{format(value)}</Text>
      <StepButton symbol="+" label={`Increase ${label}`} disabled={value >= max} onPress={() => set(value + step)} />
    </View>
  );
}

function StepButton({ symbol, label, disabled, onPress }: { symbol: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.symbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  button: {
    width: Layout.minTouch + 4,
    height: Layout.minTouch + 4,
    borderRadius: Radius.control,
    borderWidth: 1.5,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: Colors.brandSoft },
  disabled: { opacity: 0.4 },
  symbol: { fontSize: 24, fontWeight: '700', color: Colors.brandStrong, lineHeight: 26 },
  value: { minWidth: 96, textAlign: 'center', fontSize: 20, fontWeight: '800', color: Colors.brandStrong },
});
