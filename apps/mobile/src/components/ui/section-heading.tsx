import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned action, e.g. a small Button or count badge. */
  action?: ReactNode;
  size?: 'page' | 'section';
};

// Uppercase orange eyebrow + title + muted subtitle (web .section-heading / .family-heading).
export function SectionHeading({ eyebrow, title, subtitle, action, size = 'section' }: SectionHeadingProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[Type.eyebrow, styles.eyebrow]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={size === 'page' ? Type.display : Type.title}>
          {title}
        </Text>
        {subtitle ? <Text style={[size === 'page' ? Type.body : Type.bodyMuted, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { marginBottom: Spacing.two },
  subtitle: { marginTop: Spacing.two, color: '#75685e' },
  action: { paddingTop: Spacing.one },
  badge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: '#fff0e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#9f4524', fontSize: 13, fontWeight: '800' },
});
