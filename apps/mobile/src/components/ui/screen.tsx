import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, Layout, Spacing } from '@/constants/theme';

import { SectionHeading } from './section-heading';

type ScreenProps = {
  eyebrow?: string;
  title?: string;
  lede?: string;
  headerAction?: ReactNode;
  children?: ReactNode;
  /** Pinned under the scroll area (e.g. Continue button); stays above the keyboard. */
  footer?: ReactNode;
  edges?: Edge[];
  /** Pull-to-refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Content above the page heading (e.g. the welcome brand row). */
  header?: ReactNode;
  /** Full-width content after the main column (e.g. the welcome preview panel). */
  after?: ReactNode;
};

// Page shell: safe area, warm paper background, centered max-width column, page heading.
export function Screen({ eyebrow, title, lede, headerAction, children, footer, edges = ['top', 'left', 'right'], refreshing, onRefresh, header, after }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={Colors.brand} colors={[Colors.brand]} /> : undefined}>
          <View style={styles.inner}>
            {header}
            {title ? <SectionHeading size="page" eyebrow={eyebrow} title={title} subtitle={lede} action={headerAction} /> : null}
            <View style={[styles.body, !title && !header && styles.bodyNoTitle]}>{children}</View>
          </View>
          {after}
        </ScrollView>
        {footer ? (
          <View style={styles.footer}>
            <View style={styles.inner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Colors.paper },
  content: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.four, paddingBottom: Spacing.nine },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  body: { gap: Spacing.four, marginTop: Spacing.six },
  bodyNoTitle: { marginTop: 0 },
  footer: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    backgroundColor: Colors.paper,
  },
});
