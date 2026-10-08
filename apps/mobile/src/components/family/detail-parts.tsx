import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';

// Small building blocks shared by the story and play-idea sheets (web dialog styles).

export function MetaPills({ items }: { items: (string | number | undefined | null)[] }) {
  const visible = items.filter((item) => item !== undefined && item !== null && String(item).trim() !== '');
  if (!visible.length) return null;
  return (
    <View style={styles.pills}>
      {visible.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.pill}>
          <Text style={styles.pillText}>{String(item)}</Text>
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function BulletList({ items, ordered = false, quote = false }: { items?: string[]; ordered?: boolean; quote?: boolean }) {
  if (!items?.length) return null;
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.listRow}>
          <Text style={styles.bullet}>{ordered ? `${index + 1}.` : '•'}</Text>
          <Text style={styles.listText}>{quote ? `“${item}”` : item}</Text>
        </View>
      ))}
    </View>
  );
}

export function TipsBox({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.tips}>
      <Text style={styles.tipsTitle}>{title}</Text>
      <BulletList items={items} />
    </View>
  );
}

export function StatusLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.status}>
      {text}
    </Text>
  );
}

export function SheetHeading({ eyebrow, title, summary }: { eyebrow: string; title: string; summary?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={Type.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  title: { color: Colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 34 },
  summary: { color: Colors.muted, fontSize: 15, lineHeight: 23 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { backgroundColor: '#edf3e5', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  pillText: { color: Colors.greenInk, fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800', marginTop: Spacing.two },
  list: { gap: 6 },
  listRow: { flexDirection: 'row', gap: Spacing.two },
  bullet: { color: Colors.muted, fontSize: 15, lineHeight: 22, minWidth: 16 },
  listText: { flex: 1, color: Colors.muted, fontSize: 15, lineHeight: 22 },
  tips: { backgroundColor: Colors.tipsBg, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 16, gap: 8 },
  tipsTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  status: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
});
