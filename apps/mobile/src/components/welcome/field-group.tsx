import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';

// Uppercase gray label above a group of chips (web .welcome-label).
export function FieldGroup({ label, optional, children }: { label: string; optional?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={Type.caps}>
        {label}
        {optional ? <Text style={styles.optional}> {optional}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  optional: { fontWeight: '500', letterSpacing: 0, textTransform: 'none', color: Colors.capsLabel },
});
