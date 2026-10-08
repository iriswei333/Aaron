import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Layout, Spacing } from '@/constants/theme';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
  /** Pinned at the bottom (e.g. Close / Delete). */
  footer?: ReactNode;
};

// Native detail sheet (iOS page sheet / Android full-screen modal), replacing the web .modal-dialog.
export function Sheet({ visible, onClose, closeLabel = 'Close', children, footer }: SheetProps) {
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.childCardMid },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  close: { width: Layout.minTouch, height: Layout.minTouch, borderRadius: 22, borderWidth: 1, borderColor: Colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  closePressed: { backgroundColor: Colors.brandSoft },
  closeText: { fontSize: 26, lineHeight: 28, color: Colors.ink },
  content: { paddingHorizontal: Layout.gutter + 4, paddingBottom: Spacing.seven, gap: Spacing.four },
  footer: { flexDirection: 'column', gap: 9, paddingHorizontal: Layout.gutter, paddingTop: Spacing.three, paddingBottom: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.line },
});
