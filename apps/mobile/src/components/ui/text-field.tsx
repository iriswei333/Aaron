import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Layout, Radius, Spacing, Type } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  /** 'caps' = small uppercase gray label (web welcome form). */
  labelVariant?: 'default' | 'caps';
};

// Labeled input matching web .welcome-label inputs. 16px text so iOS never zooms.
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, labelVariant = 'default', style, ...inputProps },
  ref,
) {
  return (
    <View style={styles.field}>
      <Text style={labelVariant === 'caps' ? Type.caps : Type.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={Colors.faint}
        style={[styles.input, labelVariant === 'caps' && styles.inputWelcome, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={Type.small}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  input: {
    minHeight: Layout.minTouch + 6,
    borderWidth: 1.5,
    borderColor: Colors.brandBorder,
    borderRadius: Radius.control,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
    color: Colors.ink,
  },
  inputWelcome: { borderColor: Colors.inputBorder, borderRadius: Radius.sm, fontSize: 16 },
  inputError: { borderColor: Colors.danger },
  error: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
});
